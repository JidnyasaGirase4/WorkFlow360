from decimal import Decimal

import pytest

from app.core.exceptions import UnprocessableError
from app.services.billing_math import BillingError, compute_line, compute_totals, money, validated_totals

D = Decimal


def line(quantity=1, unit_price=0, tax_rate=0, discount=0):
    return {"quantity": quantity, "unit_price": unit_price, "tax_rate": tax_rate, "discount": discount}


def test_money_rounds_half_up_to_two_places():
    assert money(D("0.125")) == D("0.13")
    assert money(D("0.124")) == D("0.12")
    assert money(D("2.665")) == D("2.67")  # banker's rounding would give 2.66
    assert money(0.1 + 0.2) == D("0.30")  # floats are converted via str, no binary noise
    assert str(money(5)) == "5.00"


def test_line_gross_is_quantity_times_price():
    result = compute_line(3, D("33.33"))
    assert result.gross == D("99.99") and result.total == D("99.99") and result.tax == D("0.00")
    assert compute_line(D("1.5"), D("10.01")).gross == D("15.02")  # 15.015 -> half up


def test_line_tax_rounds_half_up():
    assert compute_line(1, D("10.05"), 18).tax == D("1.81")  # 1.809
    assert compute_line(1, D("0.25"), 10).tax == D("0.03")  # 0.025 -> 0.03 (half-even would give 0.02)
    assert compute_line(1, D("100"), D("12.5")).tax == D("12.50")


def test_line_discount_is_an_absolute_amount_taken_before_tax():
    result = compute_line(2, 100, 10, 50)
    assert (result.gross, result.discount, result.taxable, result.tax, result.total) == (D("200.00"), D("50.00"), D("150.00"), D("15.00"), D("165.00"))


def test_line_discount_may_equal_gross_but_not_exceed_it():
    assert compute_line(1, 100, 18, 100).total == D("0.00")
    with pytest.raises(BillingError) as err:
        compute_line(1, D("100"), 0, D("100.01"))
    assert err.value.field == "items.0.discount"


@pytest.mark.parametrize(
    ("kwargs", "field"),
    [
        (dict(quantity=0, unit_price=1), "quantity"),
        (dict(quantity=-1, unit_price=1), "quantity"),
        (dict(quantity=1, unit_price=-1), "unit_price"),
        (dict(quantity=1, unit_price=1, tax_rate=D("100.01")), "tax_rate"),
        (dict(quantity=1, unit_price=1, tax_rate=-1), "tax_rate"),
        (dict(quantity=1, unit_price=1, discount=-1), "discount"),
    ],
)
def test_line_rejects_invalid_inputs(kwargs, field):
    with pytest.raises(BillingError) as err:
        compute_line(**kwargs)
    assert err.value.field == f"items.0.{field}"


def test_zero_price_and_full_tax_rate_are_valid():
    assert compute_line(1, 0, 100).total == D("0.00")
    assert compute_line(1, 100, 100).total == D("200.00")


def test_document_totals_combine_lines():
    totals = compute_totals([line(2, 100, 10, 50), line(1, "80.50", 18)])
    assert totals.subtotal == D("280.50")  # 200 + 80.50
    assert totals.discount_amount == D("50.00")
    assert totals.tax_amount == D("29.49")  # 15.00 + 14.49
    assert totals.total_amount == D("259.99")  # 280.50 - 50.00 + 29.49
    assert [l.total for l in totals.lines] == [D("165.00"), D("94.99")]


def test_additional_discount_adds_to_discount_amount_but_not_to_tax():
    totals = compute_totals([line(1, 1000, 18, 100)], additional_discount=D("50"))
    assert totals.subtotal == D("1000.00")
    assert totals.discount_amount == D("150.00")  # 100 line + 50 additional
    assert totals.additional_discount == D("50.00")
    assert totals.tax_amount == D("162.00")  # tax only on (1000 - 100)
    assert totals.total_amount == D("1012.00")  # 1000 - 150 + 162


def test_tax_is_rounded_per_line_then_summed():
    totals = compute_totals([line(1, "0.25", 10)] * 3)
    assert totals.tax_amount == D("0.09")  # 3 x 0.03, not round(0.075) = 0.08


def test_negative_total_is_rejected():
    with pytest.raises(BillingError) as err:
        compute_totals([line(1, 100)], additional_discount=D("100.01"))
    assert err.value.field == "additional_discount"
    assert compute_totals([line(1, 100)], additional_discount=100).total_amount == D("0.00")


def test_negative_additional_discount_and_empty_items_are_rejected():
    with pytest.raises(BillingError):
        compute_totals([line(1, 100)], additional_discount=-1)
    with pytest.raises(BillingError) as err:
        compute_totals([])
    assert err.value.field == "items"


def test_error_reports_the_index_of_the_bad_line():
    with pytest.raises(BillingError) as err:
        compute_totals([line(1, 10), line(1, 10), line(0, 10)])
    assert err.value.field == "items.2.quantity"


def test_accepts_objects_and_ignores_missing_optional_fields():
    class Item:
        quantity, unit_price, tax_rate, discount = D("2"), D("10"), None, None

    assert compute_totals([Item()]).total_amount == D("20.00")


def test_absurdly_large_amounts_are_rejected_before_they_hit_the_database():
    with pytest.raises(BillingError):
        compute_totals([line(D("9999999999.99"), D("9999999999.99"))])


def test_validated_totals_maps_errors_to_422_with_field():
    with pytest.raises(UnprocessableError) as err:
        validated_totals([line(1, 10, 0, 11)])
    assert err.value.status_code == 422 and "items.0.discount" in err.value.errors
