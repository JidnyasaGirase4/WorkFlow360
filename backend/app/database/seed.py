"""Demo data so the React frontend looks populated right after setup.

    python -m app.database.seed            # seed an empty database
    python -m app.database.seed --reset    # drop + recreate every table first (development only!)

All dates are relative to "today", so dashboards always look current.
LOCAL DEVELOPMENT ONLY: every demo account uses the password below — never use it anywhere real.
"""
import argparse
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import (
    AttendanceStatus, ClientStatus, DocumentCategory, DocumentVisibility, ExpenseCategory, InvoiceStatus,
    LeadActivityType, LeadSource, LeadStatus, LeaveStatus, LeaveType, MeetingStatus, MeetingType,
    MilestoneStatus, NotificationType, PaymentMethod, Priority, ProjectStatus, QuotationStatus, ResponseStatus,
    RoleName, TaskStatus, TicketStatus,
)
from app.core.security import hash_password
from app.database.base import utcnow
from app.database.connection import SessionLocal, engine
from app.database.init_db import create_schema
from app.models import (
    ActivityLog, AttendanceRecord, Client, ClientContact, Company, Department, Document, Employee, Expense,
    Holiday, Invoice, InvoiceItem, Lead, LeadActivity, LeaveRequest, Meeting, MeetingParticipant, Milestone,
    Notification, Payment, Project, ProjectMember, Quotation, QuotationItem, Role, Task, TaskComment, Ticket,
    TicketComment, User,
)
from app.services.billing_math import compute_totals

DEMO_PASSWORD = "Password@123"
TODAY = date.today()


def d(offset: int) -> date:
    """A date `offset` days from today (negative = past)."""
    return TODAY + timedelta(days=offset)


def dt(offset: int, hour: int = 10) -> datetime:
    return datetime.combine(d(offset), time(hour, 0))


class Seeder:
    def __init__(self, db: Session):
        self.db = db
        self.pw_hash = hash_password(DEMO_PASSWORD)
        self.roles = {r.name: r for r in db.scalars(select(Role))}
        self.users: dict[str, User] = {}
        self.emps: dict[str, Employee] = {}
        self.depts: dict[str, Department] = {}
        self.clients: dict[str, Client] = {}
        self.projects: dict[str, Project] = {}

    # ---- helpers ---------------------------------------------------------
    def user(self, key: str, name: str, email: str, role: RoleName, company: Company | None, phone: str | None = None, client: Client | None = None) -> User:
        u = User(
            company_id=company.id if company else None, client_id=client.id if client else None, name=name, email=email,
            phone=phone, password_hash=self.pw_hash, role_id=self.roles[role.value].id, email_verified=True,
            last_login=utcnow() - timedelta(hours=len(self.users)),
        )
        self.db.add(u)
        self.db.flush()
        self.users[key] = u
        return u

    def log(self, company: Company, user: User, action: str, entity: str, entity_id: int, text: str, days_ago: int = 0) -> None:
        self.db.add(ActivityLog(company_id=company.id, user_id=user.id, action=action, entity_type=entity, entity_id=entity_id,
                                description=text, ip_address="127.0.0.1", created_at=utcnow() - timedelta(days=days_ago, minutes=len(text) % 50)))

    # ---- seeding ---------------------------------------------------------
    def run(self) -> None:
        company = self.company_and_people()
        self.clients_and_contacts(company)
        self.projects_milestones_tasks(company)
        self.billing(company)
        self.crm(company)
        self.support(company)
        self.meetings(company)
        self.documents(company)
        self.hr(company)
        self.notifications(company)
        self.second_company()
        self.db.commit()

    def company_and_people(self) -> Company:
        db = self.db
        company = Company(name="TechNova Solutions", slug="technova-solutions", industry="Software & IT Services",
                          address="4th Floor, Cyber Towers, HITEC City, Hyderabad, Telangana 500081", phone="+91 98765 43210",
                          email="company@workflow360.local", website="https://www.technova.in", gstin="36AABCT1234F1Z5")
        db.add(company)
        db.flush()
        self.company = company

        self.user("super", "Super Admin", "admin@workflow360.local", RoleName.SUPER_ADMIN, None)
        for name in ("Development", "Design", "HR", "Sales", "Finance", "Support", "Delivery", "QA", "Leadership"):
            dept = Department(company_id=company.id, name=name, description=f"{name} team")
            db.add(dept)
            self.depts[name] = dept
        db.flush()

        # key, name, email, role, department, designation, salary, code
        people = [
            ("admin", "Jidnyasa Girase", "company@workflow360.local", RoleName.COMPANY_ADMIN, "Leadership", "Founder & CEO", 300000, "TN-0001"),
            ("manager", "Jay Girase", "manager@workflow360.local", RoleName.MANAGER, "Delivery", "Project Manager", 140000, "TN-0007"),
            ("rohit", "Rohit Girase", "employee@workflow360.local", RoleName.EMPLOYEE, "Development", "Senior Frontend Developer", 110000, "TN-0011"),
            ("sneha", "Sneha Joshi", "sneha.joshi@workflow360.local", RoleName.EMPLOYEE, "Design", "UI/UX Designer", 90000, "TN-0014"),
            ("amit", "Amit Kulkarni", "amit.kulkarni@workflow360.local", RoleName.EMPLOYEE, "Development", "Backend Developer", 105000, "TN-0016"),
            ("tanvi", "Tanvi Deshpande", "tanvi.deshpande@workflow360.local", RoleName.EMPLOYEE, "QA", "QA Engineer", 75000, "TN-0019"),
            ("karthik", "Karthik Reddy", "karthik.reddy@workflow360.local", RoleName.EMPLOYEE, "Development", "DevOps Engineer", 115000, "TN-0021"),
            ("pooja", "Pooja Nair", "pooja.nair@workflow360.local", RoleName.EMPLOYEE, "HR", "HR Executive", 65000, "TN-0024"),
            ("ishaan", "Ishaan Verma", "ishaan.verma@workflow360.local", RoleName.EMPLOYEE, "Sales", "Sales Executive", 70000, "TN-0027"),
            ("meera", "Meera Iyer", "meera.iyer@workflow360.local", RoleName.EMPLOYEE, "Finance", "Accountant", 80000, "TN-0030"),
            ("rohan", "Rohan Gupta", "rohan.gupta@workflow360.local", RoleName.EMPLOYEE, "Support", "Support Engineer", 60000, "TN-0033"),
        ]
        for i, (key, name, email, role, dept, title, salary, code) in enumerate(people):
            u = self.user(key, name, email, role, company, phone=f"+91 98{i:02d}0 1{i:04d}")
            e = Employee(
                company_id=company.id, user_id=u.id, department_id=self.depts[dept].id, designation=title, employee_code=code,
                joining_date=d(-1800 + i * 90), salary=Decimal(salary), address="Hyderabad, Telangana", location="Hyderabad HQ",
                emergency_contact_name="Family Contact", emergency_contact_phone="+91 90000 00000", emergency_contact_relation="Spouse",
                skills=["Communication", "Teamwork"], gender="Female" if name.split()[0] in {"Jidnyasa", "Sneha", "Tanvi", "Pooja", "Meera"} else "Male",
            )
            db.add(e)
            self.emps[key] = e
        db.flush()
        for key in ("rohit", "sneha", "amit", "tanvi", "karthik"):
            self.emps[key].manager_id = self.emps["manager"].id
        return company

    def clients_and_contacts(self, company: Company) -> None:
        rows = [
            ("brightpixel", "BrightPixel Labs", "Aditi Rao", "aditi@brightpixel.in", "Digital Agency", "Pune", "active"),
            ("cloudmatrix", "CloudMatrix Technologies", "Karan Mehta", "karan@cloudmatrix.in", "IT Services", "Bengaluru", "active"),
            ("innosoft", "InnoSoft Systems", "Neha Kapoor", "neha@innosoft.in", "Software Product", "Hyderabad", "active"),
            ("meridian", "Meridian Retail Pvt Ltd", "Suresh Pillai", "suresh@meridianretail.in", "E-commerce", "Mumbai", "active"),
            ("zenith", "Zenith Financial Group", "Ritu Malhotra", "ritu@zenithfin.in", "FinTech", "Gurugram", "inactive"),
            ("coastal", "Coastal Hospitality Inc", "Farhan Sheikh", "farhan@coastalhospitality.in", "Hospitality", "Goa", "active"),
            ("nimbus", "Nimbus Freight", "Vikram Anand", "vikram@nimbusfreight.in", "Logistics", "Chennai", "prospect"),
        ]
        for i, (key, name, contact, email, industry, city, status) in enumerate(rows):
            c = Client(company_id=company.id, company_name=name, contact_name=contact, email=email, phone=f"+91 91234 5{i:04d}",
                       website=f"https://www.{name.split()[0].lower()}.in", industry=industry, city=city, state="India", country="India",
                       status=ClientStatus(status), created_by=self.users["admin"].id)
            c.contacts = [
                ClientContact(name=contact, email=email, phone=c.phone, designation="Primary contact", is_primary=True),
                ClientContact(name=f"Accounts — {name.split()[0]}", email=f"accounts@{email.split('@')[1]}", designation="Accounts payable"),
            ]
            self.db.add(c)
            self.clients[key] = c
        self.db.flush()
        self.user("client", "Aditi Rao", "client@workflow360.local", RoleName.CLIENT, company, client=self.clients["brightpixel"])
        self.user("client2", "Karan Mehta", "karan.mehta@workflow360.local", RoleName.CLIENT, company, client=self.clients["cloudmatrix"])
        for key, c in self.clients.items():
            self.log(company, self.users["admin"], "created", "client", c.id, f"Created client {c.company_name}", days_ago=60)

    def projects_milestones_tasks(self, company: Company) -> None:
        db, U, E = self.db, self.users, self.emps
        specs = [
            # key, name, client, manager, status, progress-ignored, budget, start, end, team
            ("website", "Corporate Website Redesign", "brightpixel", "manager", ProjectStatus.ACTIVE, 620000, -117, 40, ["rohit", "sneha", "tanvi"]),
            ("crm", "CRM Implementation", "cloudmatrix", "manager", ProjectStatus.ACTIVE, 1450000, -73, 116, ["amit", "rohit", "karthik"]),
            ("ecom", "E-commerce Platform", "meridian", "admin", ProjectStatus.PLANNING, 980000, -25, 155, ["sneha", "amit", "tanvi"]),
            ("mobile", "Mobile Application — InnoSoft", "innosoft", "manager", ProjectStatus.ON_HOLD, 760000, -129, 80, ["rohit", "tanvi"]),
            ("booking", "Booking & Membership Portal", "coastal", "admin", ProjectStatus.ACTIVE, 540000, -100, 30, ["sneha", "amit"]),
            ("analytics", "Internal Analytics Dashboard", "zenith", "manager", ProjectStatus.COMPLETED, 410000, -240, -20, ["amit", "karthik"]),
            ("payroll", "Payroll & HR Portal", "zenith", "manager", ProjectStatus.ACTIVE, 350000, -40, 90, ["rohit", "karthik", "pooja"]),
            ("helpdesk", "Customer Helpdesk Revamp", "nimbus", "manager", ProjectStatus.PLANNING, 280000, -5, 120, ["sneha", "rohan", "amit"]),
        ]
        for i, (key, name, client, mgr, status, budget, start, end, team) in enumerate(specs, start=1):
            p = Project(company_id=company.id, client_id=self.clients[client].id, name=name, project_code=f"PRJ-{i:03d}",
                        description=f"{name} for {self.clients[client].company_name}.", manager_id=E[mgr].id,
                        start_date=d(start), end_date=d(end), budget=Decimal(budget), status=status, created_by=U["admin"].id)
            p.members = [ProjectMember(employee_id=E[mgr].id, role="Project Manager")] + [ProjectMember(employee_id=E[m].id, role=E[m].designation) for m in team]
            db.add(p)
            self.projects[key] = p
        db.flush()

        # milestones: three per project, status follows how far the project is
        for key, p in self.projects.items():
            done = {ProjectStatus.COMPLETED: 3, ProjectStatus.ACTIVE: 1, ProjectStatus.ON_HOLD: 1, ProjectStatus.PLANNING: 0}[p.status]
            span = (p.end_date - p.start_date).days
            for n, label in enumerate(("Discovery & design", "Build", "Launch"), start=1):
                status = MilestoneStatus.COMPLETED if n <= done else (MilestoneStatus.IN_PROGRESS if n == done + 1 and p.status == ProjectStatus.ACTIVE else MilestoneStatus.PENDING)
                due = p.start_date + timedelta(days=span * n // 3)
                if status == MilestoneStatus.PENDING and due < TODAY and p.status == ProjectStatus.ACTIVE:
                    status = MilestoneStatus.DELAYED
                db.add(Milestone(project_id=p.id, name=label, description=f"{label} phase of {p.name}", due_date=due, status=status,
                                 progress=100 if status == MilestoneStatus.COMPLETED else (50 if status == MilestoneStatus.IN_PROGRESS else 0)))
        db.flush()

        task_titles = {
            "website": ["Design homepage hero section", "Build responsive navbar component", "Integrate CMS content API", "QA pass on blog templates", "SEO metadata audit"],
            "crm": ["Design lead pipeline Kanban UI", "Build leads REST endpoints", "Set up CI pipeline for staging", "Client portal invoice view", "Import legacy contacts"],
            "ecom": ["Wireframe checkout flow", "Set up product catalog schema", "Payment gateway sandbox testing", "Design product listing page"],
            "mobile": ["Mobile nav accessibility fixes", "Push notification service", "Offline sync prototype"],
            "booking": ["Loyalty tier calculation logic", "Booking calendar UI polish", "Payment reconciliation report", "Membership renewal emails"],
            "analytics": ["Executive KPI dashboard", "Data warehouse ETL jobs", "Export to Excel feature"],
            "payroll": ["Salary slip PDF generator", "Attendance import job", "Tax declaration form", "Payroll audit report"],
            "helpdesk": ["Ticket triage rules", "Customer satisfaction survey", "Knowledge base migration", "SLA breach alerts"],
        }
        stage = {ProjectStatus.COMPLETED: ["completed"] * 5, ProjectStatus.ON_HOLD: ["todo", "todo", "in_progress", "todo"],
                 ProjectStatus.PLANNING: ["in_progress", "todo", "todo", "todo", "todo"],
                 ProjectStatus.ACTIVE: ["completed", "completed", "in_progress", "review", "todo", "todo"]}
        priorities = [Priority.HIGH, Priority.MEDIUM, Priority.URGENT, Priority.LOW]
        self.tasks: list[Task] = []
        for key, titles in task_titles.items():
            p = self.projects[key]
            members = [m.employee_id for m in p.members if m.employee_id != p.manager_id] or [p.manager_id]
            for n, title in enumerate(titles):
                status = TaskStatus(stage[p.status][n % len(stage[p.status])])
                due = d(-12 + n * 6) if p.status != ProjectStatus.COMPLETED else d(-30 - n)
                t = Task(company_id=company.id, project_id=p.id, assigned_to=members[n % len(members)], created_by=U["manager"].id,
                         title=title, description=f"{title} — part of {p.name}.", priority=priorities[n % 4], status=status,
                         start_date=due - timedelta(days=10), due_date=due,
                         completed_at=dt(-2) if status == TaskStatus.COMPLETED else None,
                         checklist=[{"id": f"chk-{c}", "text": step, "done": status == TaskStatus.COMPLETED or (c == 1 and status != TaskStatus.TODO)}
                                    for c, step in enumerate(("Plan the work", "Implement", "Review and hand off"), start=1)])
                db.add(t)
                self.tasks.append(t)
        db.flush()
        # progress is derived from tasks, exactly as the API does
        for key, p in self.projects.items():
            mine = [t for t in self.tasks if t.project_id == p.id]
            p.progress = round(100 * sum(t.status == TaskStatus.COMPLETED for t in mine) / len(mine)) if mine else 0
        emp_user = {e.id: k for k, e in E.items()}
        for i, t in enumerate(self.tasks[::2]):
            author = U[emp_user.get(t.assigned_to, "manager")]
            db.add(TaskComment(task_id=t.id, user_id=author.id, comment="Started on this — will share an update by end of day.", created_at=utcnow() - timedelta(days=i % 6)))
        for p in self.projects.values():
            self.log(company, U["manager"], "created", "project", p.id, f"Created project {p.name}", days_ago=80)
        for t in self.tasks[:10]:
            self.log(company, U["manager"], "assigned", "task", t.id, f"Assigned task '{t.title}'", days_ago=5)

    def _invoice(self, company: Company, n: int, client: str, project: str | None, issue: int, due: int, lines: list[tuple], paid: list[tuple[int, int, PaymentMethod]] | None = None, status: InvoiceStatus | None = None, terms: str = "Net 15") -> Invoice:
        """lines: (description, qty, unit_price, tax_rate). paid: (amount, days_ago, method)."""
        totals = compute_totals([{"quantity": Decimal(q), "unit_price": Decimal(p), "tax_rate": Decimal(t), "discount": Decimal(0)} for _, q, p, t in lines], Decimal(0))
        inv = Invoice(company_id=company.id, invoice_number=f"INV-{TODAY.year}-{n:05d}", client_id=self.clients[client].id,
                      project_id=self.projects[project].id if project else None, issue_date=d(issue), due_date=d(due), payment_terms=terms,
                      subtotal=totals.subtotal, tax_amount=totals.tax_amount, additional_discount=Decimal(0), discount_amount=totals.discount_amount,
                      total_amount=totals.total_amount, created_by=self.users["manager"].id, notes="Thank you for your business.")
        inv.items = [InvoiceItem(description=desc, quantity=Decimal(q), unit_price=Decimal(p), tax_rate=Decimal(t), discount=Decimal(0), total=line.total)
                     for (desc, q, p, t), line in zip(lines, totals.lines)]
        received = sum((Decimal(amount) for amount, _, _ in paid or []), Decimal(0))
        inv.paid_amount = received
        inv.balance_amount = inv.total_amount - received
        if status is None:
            status = InvoiceStatus.PAID if inv.balance_amount == 0 else InvoiceStatus.PARTIALLY_PAID if received > 0 else (InvoiceStatus.OVERDUE if d(due) < TODAY else InvoiceStatus.SENT)
        inv.status = status
        self.db.add(inv)
        self.db.flush()
        for amount, ago, method in paid or []:
            self.db.add(Payment(company_id=company.id, invoice_id=inv.id, client_id=inv.client_id, amount=Decimal(amount), payment_date=d(-ago),
                                payment_method=method, reference_number=f"REF-{n}{ago:02d}", created_by=self.users["admin"].id))
        self.log(company, self.users["manager"], "created", "invoice", inv.id, f"Created invoice {inv.invoice_number}", days_ago=max(0, -issue))
        return inv

    def billing(self, company: Company) -> None:
        B, M = PaymentMethod.BANK_TRANSFER, PaymentMethod
        inv = self._invoice
        inv(company, 101, "brightpixel", "website", -60, -45, [("Website Redesign — Milestone 1", 1, 200000, 18)], [(236000, 44, B)])
        inv(company, 102, "brightpixel", "website", -30, -15, [("Website Redesign — Milestone 2", 1, 220000, 18), ("Extra revision rounds", 2, 15000, 18)], [(295000, 16, B)])
        inv(company, 103, "brightpixel", "website", -5, 10, [("Website Redesign — Milestone 3", 1, 125000, 18)], [(60000, 1, M.UPI)])
        inv(company, 104, "cloudmatrix", "crm", -75, -60, [("CRM Implementation — Phase 1", 1, 480000, 18)], [(566400, 58, B)])
        inv(company, 105, "cloudmatrix", "crm", -20, -5, [("CRM Implementation — Phase 2", 1, 350000, 18)], [(200000, 4, B)])
        inv(company, 106, "innosoft", "mobile", -50, -35, [("Mobile App — Design sprint", 1, 180000, 18)])  # overdue
        inv(company, 107, "meridian", "ecom", -10, 5, [("E-commerce — Discovery & architecture", 1, 250000, 18)])
        inv(company, 108, "zenith", "analytics", -120, -105, [("Analytics Dashboard — Final delivery", 1, 410000, 18)], [(483800, 100, M.CHEQUE)])
        inv(company, 109, "coastal", "booking", -25, -10, [("Booking Portal — Loyalty module", 1, 140000, 18)], [(50000, 8, M.CARD)])
        inv(company, 110, "zenith", "payroll", -3, 12, [("Payroll Portal — Kickoff", 1, 90000, 18)], status=InvoiceStatus.DRAFT)
        inv(company, 111, "nimbus", None, -8, 7, [("Consulting — Helpdesk workshop", 3, 20000, 18)], status=InvoiceStatus.CANCELLED)
        inv(company, 112, "coastal", "booking", -45, -30, [("Booking Portal — Calendar UI", 1, 95000, 18)], [(112100, 28, M.UPI)])
        self.db.flush()

        quotes = [(1, "meridian", "ecom", QuotationStatus.SENT, [("Checkout & payments build", 1, 420000, 18)]),
                  (2, "nimbus", None, QuotationStatus.DRAFT, [("Helpdesk implementation", 1, 280000, 18), ("Training", 2, 15000, 18)]),
                  (3, "coastal", "booking", QuotationStatus.ACCEPTED, [("Mobile app extension", 1, 300000, 18)])]
        for n, client, project, status, lines in quotes:
            totals = compute_totals([{"quantity": Decimal(q), "unit_price": Decimal(p), "tax_rate": Decimal(t), "discount": Decimal(0)} for _, q, p, t in lines], Decimal(0))
            q = Quotation(company_id=company.id, quotation_number=f"QUO-{TODAY.year}-{n:03d}", client_id=self.clients[client].id,
                          project_id=self.projects[project].id if project else None, issue_date=d(-7 * n), valid_until=d(30 - 7 * n), subtotal=totals.subtotal,
                          tax_amount=totals.tax_amount, discount_amount=totals.discount_amount, total_amount=totals.total_amount, status=status,
                          created_by=self.users["manager"].id)
            q.items = [QuotationItem(description=desc, quantity=Decimal(qty), unit_price=Decimal(price), tax_rate=Decimal(tax), discount=Decimal(0), total=line.total)
                       for (desc, qty, price, tax), line in zip(lines, totals.lines)]
            self.db.add(q)

        exp = [("Figma team licences", ExpenseCategory.SOFTWARE, 18000, -40, "sneha", "website"), ("AWS staging environment", ExpenseCategory.SOFTWARE, 42000, -30, "karthik", "crm"),
               ("Client visit — Bengaluru", ExpenseCategory.TRAVEL, 26500, -22, "manager", "crm"), ("Office internet", ExpenseCategory.OFFICE, 9500, -18, None, None),
               ("LinkedIn ads", ExpenseCategory.MARKETING, 35000, -15, "ishaan", None), ("Monitor for new hire", ExpenseCategory.EQUIPMENT, 21000, -12, "rohan", None),
               ("Team lunch — sprint demo", ExpenseCategory.OFFICE, 6400, -9, "manager", "website"), ("Domain & hosting renewal", ExpenseCategory.SOFTWARE, 11800, -7, "amit", "booking"),
               ("Flight — Goa workshop", ExpenseCategory.TRAVEL, 18200, -6, "sneha", "booking"), ("Payroll — contractor", ExpenseCategory.SALARY, 60000, -5, None, "payroll"),
               ("Conference tickets", ExpenseCategory.MARKETING, 24000, -3, "ishaan", None), ("Laptop accessories", ExpenseCategory.EQUIPMENT, 7800, -1, "tanvi", None)]
        for title, cat, amt, days, emp, proj in exp:
            self.db.add(Expense(company_id=company.id, title=title, category=cat, amount=Decimal(amt), expense_date=d(days),
                                employee_id=self.emps[emp].id if emp else None, project_id=self.projects[proj].id if proj else None,
                                created_by=self.users["admin"].id, description=title))

    def crm(self, company: Company) -> None:
        owner = self.users["manager"].id
        leads = [("Orbit Logistics", "Vikram Anand", LeadSource.WEBSITE, LeadStatus.NEW, 450000, 3), ("Vertex Realty", "Ishaan Kapoor", LeadSource.REFERRAL, LeadStatus.CONTACTED, 620000, 2),
                 ("Nova Health", "Dr. Meena Rao", LeadSource.EMAIL, LeadStatus.QUALIFIED, 890000, 5), ("Pixel Studio", "Arjun Sethi", LeadSource.SOCIAL_MEDIA, LeadStatus.PROPOSAL, 380000, 4),
                 ("GreenLeaf Foods", "Kavita Shah", LeadSource.ADVERTISEMENT, LeadStatus.NEGOTIATION, 1200000, 1), ("Skyline Travels", "Rahul Bose", LeadSource.COLD_CALL, LeadStatus.LOST, 250000, -10),
                 ("Urban Bites", "Simran Kaur", LeadSource.WEBSITE, LeadStatus.NEW, 310000, 6), ("EduSpark", "Prof. Iyer", LeadSource.REFERRAL, LeadStatus.QUALIFIED, 540000, 7),
                 ("Medico Plus", "Anil Deshmukh", LeadSource.OTHER, LeadStatus.CONTACTED, 720000, 2), ("BlueWave Energy", "Tara Menon", LeadSource.WEBSITE, LeadStatus.PROPOSAL, 960000, 8)]
        for i, (name, contact, source, status, value, follow) in enumerate(leads):
            lead = Lead(company_id=company.id, company_name=name, contact_name=contact, email=f"{contact.split()[-1].lower()}@{name.split()[0].lower()}.in", phone=f"+91 98450 1{i:04d}",
                        source=source, status=status, estimated_value=Decimal(value), owner_id=owner, priority=[Priority.HIGH, Priority.MEDIUM, Priority.LOW][i % 3],
                        next_followup_date=d(follow), last_contact_date=d(-i - 1), notes=f"Interested in a custom solution for {name}.", created_at=dt(-20 + i))
            self.db.add(lead)
            self.db.flush()
            for j, kind in enumerate((LeadActivityType.CALL, LeadActivityType.EMAIL)):
                self.db.add(LeadActivity(lead_id=lead.id, user_id=owner, activity_type=kind, description=f"{kind.value.title()} with {contact}", activity_date=dt(-i - j)))

    def support(self, company: Company) -> None:
        U, db = self.users, self.db
        agents = [U["rohan"], U["amit"], U["manager"], U["admin"]]
        rows = [
            ("Unable to upload files over 10MB", "brightpixel", "website", Priority.HIGH, TicketStatus.OPEN, "Technical Issue", -7),
            ("Request to add a new team member to project", "cloudmatrix", "crm", Priority.LOW, TicketStatus.IN_PROGRESS, "Access & Permissions", -6),
            ("Invoice PDF shows incorrect GST amount", "innosoft", "mobile", Priority.URGENT, TicketStatus.WAITING_FOR_CLIENT, "Billing & Invoicing", -14),
            ("Need export of project reports to CSV", "brightpixel", "website", Priority.MEDIUM, TicketStatus.RESOLVED, "Feature Request", -20),
            ("Login page shows blank screen on Safari", "coastal", "booking", Priority.HIGH, TicketStatus.IN_PROGRESS, "Technical Issue", -4),
            ("Webhook not firing for paid invoices", "cloudmatrix", "crm", Priority.URGENT, TicketStatus.OPEN, "Integration", -2),
            ("How do I add another billing contact?", "brightpixel", None, Priority.LOW, TicketStatus.CLOSED, "General Query", -30),
            ("Staging site returns 502 intermittently", "meridian", "ecom", Priority.HIGH, TicketStatus.OPEN, "Technical Issue", -1),
            ("Update company GSTIN on invoices", "zenith", "payroll", Priority.MEDIUM, TicketStatus.RESOLVED, "Billing & Invoicing", -12),
            ("Request for additional user seats", "coastal", None, Priority.LOW, TicketStatus.WAITING_FOR_CLIENT, "Access & Permissions", -9),
            ("Dashboard charts load slowly", "cloudmatrix", "crm", Priority.MEDIUM, TicketStatus.IN_PROGRESS, "Technical Issue", -3),
            ("Password reset email not received", "innosoft", None, Priority.MEDIUM, TicketStatus.CLOSED, "Access & Permissions", -25),
        ]
        for i, (subject, client, project, priority, status, category, ago) in enumerate(rows, start=1):
            requester = U["client"] if client == "brightpixel" else U["client2"] if client == "cloudmatrix" else U["admin"]
            resolved = status in (TicketStatus.RESOLVED, TicketStatus.CLOSED)
            t = Ticket(company_id=company.id, ticket_number=f"TCK-{i:04d}", client_id=self.clients[client].id, project_id=self.projects[project].id if project else None,
                       subject=subject, description=f"{subject}. Please look into this at the earliest.", category=category, priority=priority, status=status,
                       assigned_to=agents[i % len(agents)].id, created_by=requester.id, created_at=dt(ago), resolved_at=dt(ago + 2) if resolved else None)
            db.add(t)
            db.flush()
            db.add(TicketComment(ticket_id=t.id, user_id=requester.id, comment="Reporting this issue — happy to share more details if needed.", created_at=dt(ago, 11)))
            db.add(TicketComment(ticket_id=t.id, user_id=t.assigned_to, comment="Thanks for flagging — we are looking into it.", created_at=dt(ago, 14)))
            db.add(TicketComment(ticket_id=t.id, user_id=t.assigned_to, is_internal=True, comment="Internal note: reproduced on staging, root cause identified.", created_at=dt(ago, 15)))
            self.log(company, requester, "created", "ticket", t.id, f"Created ticket {t.ticket_number}", days_ago=-ago)

    def meetings(self, company: Company) -> None:
        U = self.users
        rows = [
            ("Sprint Review — CRM Implementation", "cloudmatrix", "crm", MeetingType.PROJECT_REVIEW, 1, ["manager", "amit", "client2"], MeetingStatus.SCHEDULED),
            ("Discovery Kickoff — E-commerce", "meridian", "ecom", MeetingType.CLIENT_MEETING, 2, ["admin", "sneha"], MeetingStatus.SCHEDULED),
            ("Design Review — Booking Portal", "coastal", "booking", MeetingType.PROJECT_REVIEW, 3, ["sneha", "manager"], MeetingStatus.SCHEDULED),
            ("Monthly Check-in — BrightPixel", "brightpixel", "website", MeetingType.CLIENT_MEETING, -16, ["manager", "client"], MeetingStatus.COMPLETED),
            ("Weekly Engineering Sync", None, None, MeetingType.INTERNAL, 4, ["manager", "rohit", "amit", "karthik", "tanvi"], MeetingStatus.SCHEDULED),
            ("Sales Pipeline Review", None, None, MeetingType.SALES, 5, ["admin", "ishaan", "manager"], MeetingStatus.SCHEDULED),
            ("Onboarding Call — Nimbus Freight", "nimbus", None, MeetingType.SALES, -8, ["admin", "pooja"], MeetingStatus.CANCELLED),
            ("Quarterly Business Review", "brightpixel", "website", MeetingType.CLIENT_MEETING, 9, ["admin", "manager", "client"], MeetingStatus.SCHEDULED),
        ]
        for title, client, project, kind, days, people, status in rows:
            m = Meeting(company_id=company.id, title=title, description=f"{title}.", client_id=self.clients[client].id if client else None,
                        project_id=self.projects[project].id if project else None, created_by=U["manager"].id, meeting_date=d(days),
                        start_time=time(11, 0), end_time=time(12, 0), meeting_type=kind, status=status,
                        meeting_link="https://meet.workflow360.local/" + title.split()[0].lower())
            m.participants = [MeetingParticipant(user_id=U[p].id, response_status=ResponseStatus.ACCEPTED if p == "manager" or days < 0 else ResponseStatus.PENDING) for p in people]
            self.db.add(m)

    def documents(self, company: Company) -> None:
        U, root = self.users, get_settings().upload_path / str(company.id) / "documents"
        root.mkdir(parents=True, exist_ok=True)
        rows = [
            ("Website_Redesign_Contract.pdf", DocumentCategory.CONTRACT, "brightpixel", "website", None, DocumentVisibility.PRIVATE, "manager"),
            ("CRM_Requirements_Spec.pdf", DocumentCategory.PROJECT, "cloudmatrix", "crm", None, DocumentVisibility.CLIENT, "manager"),
            ("Brand_Guidelines.pdf", DocumentCategory.CLIENT, "coastal", "booking", None, DocumentVisibility.COMPANY, "sneha"),
            ("NDA_InnoSoft_Systems.pdf", DocumentCategory.CONTRACT, "innosoft", None, None, DocumentVisibility.PRIVATE, "admin"),
            ("Rohit_Girase_Offer_Letter.pdf", DocumentCategory.EMPLOYEE, None, None, "rohit", DocumentVisibility.PRIVATE, "admin"),
            ("Website_Progress_Report.pdf", DocumentCategory.PROJECT, "brightpixel", "website", None, DocumentVisibility.CLIENT, "manager"),
            ("Sprint_Retro_Notes.pdf", DocumentCategory.OTHER, None, "crm", None, DocumentVisibility.COMPANY, "manager"),
            ("INV-Statement.pdf", DocumentCategory.INVOICE, "brightpixel", None, None, DocumentVisibility.CLIENT, "meera"),
        ]
        for name, cat, client, project, emp, vis, uploader in rows:
            stored = f"{name.split('.')[0].lower().replace('_', '-')}.pdf"
            body = _tiny_pdf(name)
            (root / stored).write_bytes(body)
            self.db.add(Document(company_id=company.id, name=name.replace("_", " ").rsplit(".", 1)[0], file_name=name, file_path=f"{company.id}/documents/{stored}",
                                 file_type="application/pdf", file_size=len(body), category=cat, client_id=self.clients[client].id if client else None,
                                 project_id=self.projects[project].id if project else None, employee_id=self.emps[emp].id if emp else None,
                                 uploaded_by=U[uploader].id, visibility=vis))

    def hr(self, company: Company) -> None:
        db, E = self.db, self.emps
        weekdays = [d(-i) for i in range(1, 15) if d(-i).weekday() < 5][:10]
        pattern = [AttendanceStatus.PRESENT] * 6 + [AttendanceStatus.LATE, AttendanceStatus.WFH, AttendanceStatus.PRESENT, AttendanceStatus.ABSENT]
        for ei, (key, e) in enumerate(E.items()):
            for di, day in enumerate(weekdays + [TODAY] if TODAY.weekday() < 5 else weekdays):
                status = pattern[(ei * 3 + di) % len(pattern)]
                absent = status == AttendanceStatus.ABSENT
                db.add(AttendanceRecord(company_id=company.id, employee_id=e.id, attendance_date=day, status=status,
                                        check_in=None if absent else ("10:35" if status == AttendanceStatus.LATE else "09:1%d" % (ei % 10)),
                                        check_out=None if absent or day == TODAY else "18:%02d" % (10 + ei)))
        leaves = [("karthik", LeaveType.SICK, -6, -4, LeaveStatus.APPROVED, "Fever and viral infection"), ("sneha", LeaveType.CASUAL, 6, 7, LeaveStatus.PENDING, "Family function"),
                  ("tanvi", LeaveType.EARNED, 18, 22, LeaveStatus.PENDING, "Personal travel"), ("rohit", LeaveType.CASUAL, -30, -30, LeaveStatus.REJECTED, "Personal work"),
                  ("pooja", LeaveType.SICK, -21, -20, LeaveStatus.APPROVED, "Not feeling well"), ("amit", LeaveType.CASUAL, 3, 4, LeaveStatus.PENDING, "Home renovation work"),
                  ("rohit", LeaveType.EARNED, -100, -96, LeaveStatus.APPROVED, "Family trip")]
        for key, kind, a, b, status, reason in leaves:
            decided = status in (LeaveStatus.APPROVED, LeaveStatus.REJECTED)
            db.add(LeaveRequest(company_id=company.id, employee_id=E[key].id, leave_type=kind, start_date=d(a), end_date=d(b), days=Decimal((b - a) + 1), reason=reason,
                                status=status, decided_by=self.users["manager"].id if decided else None, decided_at=d(a - 2) if decided else None,
                                rejection_reason="Sprint release scheduled that day." if status == LeaveStatus.REJECTED else None))
        for offset, name in ((-40, "Independence Day"), (-12, "Ganesh Chaturthi"), (6, "Gandhi Jayanti"), (24, "Dussehra"), (43, "Diwali (Laxmi Pujan)")):
            db.add(Holiday(company_id=company.id, holiday_date=d(offset), name=name))

    def notifications(self, company: Company) -> None:
        U = self.users
        rows = [
            ("admin", "Payment received", "₹60,000 received against INV-%d-00103" % TODAY.year, NotificationType.PAYMENT, False),
            ("admin", "Invoice overdue", "INV-%d-00106 is overdue" % TODAY.year, NotificationType.INVOICE, False),
            ("admin", "New ticket", "Webhook not firing for paid invoices (TCK-0006)", NotificationType.TICKET, True),
            ("manager", "Task in review", "'QA pass on blog templates' is ready for review", NotificationType.TASK, False),
            ("manager", "Leave request", "Sneha Joshi applied for casual leave", NotificationType.SYSTEM, False),
            ("rohit", "New task assigned", "You were assigned 'Integrate CMS content API'", NotificationType.TASK, False),
            ("rohit", "Meeting tomorrow", "Sprint Review — CRM Implementation", NotificationType.MEETING, True),
            ("client", "Invoice sent", "Invoice INV-%d-00103 is ready to view" % TODAY.year, NotificationType.INVOICE, False),
            ("client", "Ticket update", "TCK-0001 status changed to In progress", NotificationType.TICKET, False),
            ("client2", "Meeting scheduled", "Sprint Review — CRM Implementation", NotificationType.MEETING, False),
        ]
        for i, (who, title, msg, kind, read) in enumerate(rows):
            self.db.add(Notification(user_id=U[who].id, title=title, message=msg, type=kind, is_read=read, created_at=utcnow() - timedelta(hours=3 * i + 1)))

    def second_company(self) -> None:
        """A tiny second workspace so data isolation is easy to demonstrate."""
        db = self.db
        other = Company(name="Northwind Digital", slug="northwind-digital", industry="Marketing", email="admin@northwind.local")
        db.add(other)
        db.flush()
        admin = self.user("nw_admin", "Nora Wind", "admin@northwind.local", RoleName.COMPANY_ADMIN, other)
        dept = Department(company_id=other.id, name="Operations")
        db.add(dept)
        db.flush()
        db.add(Employee(company_id=other.id, user_id=admin.id, department_id=dept.id, designation="Director", employee_code="NW-0001"))
        client = Client(company_id=other.id, company_name="Harbor Coffee Co", contact_name="Sam Harbor", email="sam@harborcoffee.in", status=ClientStatus.ACTIVE, created_by=admin.id)
        db.add(client)
        db.flush()
        db.add(Project(company_id=other.id, client_id=client.id, name="Brand Refresh", project_code="PRJ-001", status=ProjectStatus.ACTIVE, budget=Decimal(150000), progress=20, created_by=admin.id))


def _tiny_pdf(title: str) -> bytes:
    """A minimal valid one-page PDF so downloads open in any viewer."""
    text = title.replace("(", "").replace(")", "")
    stream = f"BT /F1 20 Tf 72 720 Td ({text}) Tj ET"
    objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = "%PDF-1.4\n", []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{body}\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n" + "".join(f"{o:010d} 00000 n \n" for o in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
    return out.encode("latin-1")


def seed(reset: bool = False) -> None:
    create_schema(reset=reset)
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)):
            raise SystemExit("Database already contains users. Run with --reset to wipe and re-seed (development only).")
        Seeder(db).run()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="drop all tables first (development only)")
    seed(parser.parse_args().reset)
    print(f"Seeded '{engine.url.database}'. Demo login password for every account: {DEMO_PASSWORD}")
    for email, role in (("admin@workflow360.local", "Super Admin"), ("company@workflow360.local", "Company Admin"), ("manager@workflow360.local", "Manager"),
                        ("employee@workflow360.local", "Employee"), ("client@workflow360.local", "Client")):
        print(f"  {role:14} {email}")
