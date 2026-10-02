"""Pure money arithmetic for invoices and quotations (no database, no HTTP).

Everything is `Decimal`, quantized to 2 places with ROUND_HALF_UP. The API never trusts totals from a
client: it feeds line inputs through `compute_totals` and stores the result. The seeder reuses these too.

Per line   gross = quantity * unit_price
           discount = absolute amount (<= gross)
           taxable = gross - discount
           tax = round(taxable * tax_rate / 100)
           total = taxable + tax
Document   subtotal = sum(gross)
           discount_amount = sum(line discounts) + additional_discount
           tax_amount = sum(line tax)
           total_amount = subtotal - discount_amount + tax_amount   (must be >= 0)
"""
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.core.exceptions import UnprocessableError

CENT = Decimal("0.01")
ZERO = Decimal("0.00")
HUNDRED = Decimal(100)
MAX_AMOUNT = Decimal("9999999999.99")  # fits Numeric(14, 2) with room for sums of many lines


class BillingError(ValueError):
    """Invalid billing input. `field` names the offending input (e.g. "items.0.discount")."""

    def __init__(self, message: str, field: str = "items"):
        super().__init__(message)
        self.message = message
        self.field = field


def money(value: Any) -> Decimal:
    """Coerce to Decimal (via str, so floats do not leak binary noise) and round to cents."""
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class LineTotals:
    gross: Decimal
    discount: Decimal
    taxable: Decimal
    tax: Decimal
    total: Decimal


@dataclass(frozen=True)
class Totals:
    subtotal: Decimal
    discount_amount: Decimal  # line discounts + additional_discount
    additional_discount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    lines: tuple[LineTotals, ...]


def compute_line(quantity: Any, unit_price: Any, tax_rate: Any = 0, discount: Any = 0, *, index: int = 0) -> LineTotals:
    where = f"items.{index}"
    quantity, unit_price, tax_rate, discount = Decimal(str(quantity)), Decimal(str(unit_price)), Decimal(str(tax_rate)), Decimal(str(discount))
    if quantity <= 0:
        raise BillingError("Quantity must be greater than 0", f"{where}.quantity")
    if unit_price < 0:
        raise BillingError("Unit price cannot be negative", f"{where}.unit_price")
    if not Decimal(0) <= tax_rate <= HUNDRED:
        raise BillingError("Tax rate must be between 0 and 100", f"{where}.tax_rate")
    if discount < 0:
        raise BillingError("Discount cannot be negative", f"{where}.discount")

    gross = money(quantity * unit_price)
    if discount > gross:
        raise BillingError("Line discount cannot exceed the line amount", f"{where}.discount")
    discount = money(discount)
    taxable = gross - discount
    tax = money(taxable * tax_rate / HUNDRED)
    total = taxable + tax
    if total > MAX_AMOUNT:
        raise BillingError("Line amount is too large", f"{where}.unit_price")
    return LineTotals(gross, discount, taxable, tax, total)


def _read(item: Any, name: str, default: Any = 0) -> Any:
    value = item.get(name, default) if isinstance(item, Mapping) else getattr(item, name, default)
    return default if value is None else value


def compute_totals(items: Iterable[Any], additional_discount: Any = 0) -> Totals:
    """Totals for a list of line inputs (objects with quantity/unit_price/tax_rate/discount, or dicts)."""
    lines = tuple(
        compute_line(_read(item, "quantity"), _read(item, "unit_price"), _read(item, "tax_rate"), _read(item, "discount"), index=i)
        for i, item in enumerate(items)
    )
    if not lines:
        raise BillingError("At least one line item is required", "items")
    additional = Decimal(str(additional_discount if additional_discount is not None else 0))
    if additional < 0:
        raise BillingError("Additional discount cannot be negative", "additional_discount")
    additional = money(additional)

    subtotal = sum((line.gross for line in lines), ZERO)
    discount_amount = sum((line.discount for line in lines), ZERO) + additional
    tax_amount = sum((line.tax for line in lines), ZERO)
    total = subtotal - discount_amount + tax_amount
    if total < 0:
        raise BillingError("Discounts cannot exceed the invoice total", "additional_discount")
    if total > MAX_AMOUNT:
        raise BillingError("Total amount is too large", "items")
    return Totals(subtotal, discount_amount, additional, tax_amount, total, lines)


def validated_totals(items: Iterable[Any], additional_discount: Any = 0) -> Totals:
    """`compute_totals` for request handling: invalid input becomes a 422 naming the field."""
    try:
        return compute_totals(items, additional_discount)
    except BillingError as exc:
        raise UnprocessableError(exc.message, {exc.field: exc.message}) from exc


def balance_of(total: Decimal, paid: Decimal) -> Decimal:
    return money(total) - money(paid)
