-- WorkFlow360 database schema (MySQL / MariaDB, XAMPP compatible)
-- Generated from the SQLAlchemy models on 2026-09-26 by scripts/export_schema.py. Do not edit by hand.

-- Select the (empty) workflow360_db database in phpMyAdmin first, then import / run this file.
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE companies (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(150) NOT NULL, 
	slug VARCHAR(160) NOT NULL, 
	industry VARCHAR(100), 
	address TEXT, 
	phone VARCHAR(30), 
	email VARCHAR(255), 
	website VARCHAR(255), 
	gstin VARCHAR(30), 
	timezone VARCHAR(64) NOT NULL, 
	currency VARCHAR(3) NOT NULL, 
	fiscal_year_start VARCHAR(12) NOT NULL, 
	logo_url VARCHAR(500), 
	status ENUM('active','suspended') NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_companies PRIMARY KEY (id), 
	CONSTRAINT uq_companies_slug UNIQUE (slug)
);

CREATE INDEX ix_companies_status ON companies (status);

CREATE TABLE permissions (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	code VARCHAR(60) NOT NULL, 
	module VARCHAR(40) NOT NULL, 
	description VARCHAR(255), 
	CONSTRAINT pk_permissions PRIMARY KEY (id), 
	CONSTRAINT uq_permissions_code UNIQUE (code)
);


CREATE TABLE roles (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(40) NOT NULL, 
	display_name VARCHAR(80) NOT NULL, 
	description VARCHAR(255), 
	CONSTRAINT pk_roles PRIMARY KEY (id), 
	CONSTRAINT uq_roles_name UNIQUE (name)
);


CREATE TABLE departments (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	description TEXT, 
	status ENUM('active','inactive') NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_departments PRIMARY KEY (id), 
	CONSTRAINT uq_departments_company_name UNIQUE (company_id, name), 
	CONSTRAINT fk_departments_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT
);


CREATE TABLE holidays (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	holiday_date DATE NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	CONSTRAINT pk_holidays PRIMARY KEY (id), 
	CONSTRAINT uq_holidays_company_date UNIQUE (company_id, holiday_date), 
	CONSTRAINT fk_holidays_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);


CREATE TABLE role_permissions (
	role_id INTEGER NOT NULL, 
	permission_id INTEGER NOT NULL, 
	CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id), 
	CONSTRAINT fk_role_permissions_role_id FOREIGN KEY(role_id) REFERENCES roles (id) ON DELETE CASCADE, 
	CONSTRAINT fk_role_permissions_permission_id FOREIGN KEY(permission_id) REFERENCES permissions (id) ON DELETE CASCADE
);


CREATE TABLE users (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER, 
	client_id INTEGER, 
	name VARCHAR(120) NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	phone VARCHAR(30), 
	password_hash VARCHAR(255) NOT NULL, 
	role_id INTEGER NOT NULL, 
	status ENUM('active','inactive','suspended') NOT NULL, 
	profile_image VARCHAR(500), 
	last_login DATETIME, 
	email_verified BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_users PRIMARY KEY (id), 
	CONSTRAINT fk_users_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT uq_users_email UNIQUE (email), 
	CONSTRAINT fk_users_role_id FOREIGN KEY(role_id) REFERENCES roles (id) ON DELETE RESTRICT
);

CREATE INDEX ix_users_client_id ON users (client_id);
CREATE INDEX ix_users_company_id ON users (company_id);
CREATE INDEX ix_users_role_id ON users (role_id);

CREATE TABLE activity_logs (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER, 
	company_id INTEGER, 
	action VARCHAR(60) NOT NULL, 
	entity_type VARCHAR(40) NOT NULL, 
	entity_id INTEGER, 
	description TEXT, 
	ip_address VARCHAR(45), 
	created_at DATETIME NOT NULL, 
	CONSTRAINT pk_activity_logs PRIMARY KEY (id), 
	CONSTRAINT fk_activity_logs_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT fk_activity_logs_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE SET NULL
);

CREATE INDEX ix_activity_logs_company_created ON activity_logs (company_id, created_at);
CREATE INDEX ix_activity_logs_entity ON activity_logs (entity_type, entity_id);
CREATE INDEX ix_activity_logs_user_id ON activity_logs (user_id);

CREATE TABLE auth_tokens (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER NOT NULL, 
	purpose ENUM('password_reset','email_verify') NOT NULL, 
	token_hash VARCHAR(64) NOT NULL, 
	expires_at DATETIME NOT NULL, 
	used_at DATETIME, 
	created_at DATETIME NOT NULL, 
	CONSTRAINT pk_auth_tokens PRIMARY KEY (id), 
	CONSTRAINT fk_auth_tokens_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	CONSTRAINT uq_auth_tokens_token_hash UNIQUE (token_hash)
);

CREATE INDEX ix_auth_tokens_user_id ON auth_tokens (user_id);

CREATE TABLE clients (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	company_name VARCHAR(150) NOT NULL, 
	contact_name VARCHAR(120), 
	email VARCHAR(255), 
	phone VARCHAR(30), 
	website VARCHAR(255), 
	industry VARCHAR(100), 
	address TEXT, 
	city VARCHAR(100), 
	state VARCHAR(100), 
	country VARCHAR(100), 
	gstin VARCHAR(30), 
	status ENUM('active','inactive','prospect','archived') NOT NULL, 
	created_by INTEGER, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_clients PRIMARY KEY (id), 
	CONSTRAINT uq_clients_company_name UNIQUE (company_id, company_name), 
	CONSTRAINT fk_clients_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_clients_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_clients_company_name ON clients (company_name);
CREATE INDEX ix_clients_company_status ON clients (company_id, status);

CREATE TABLE employees (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	department_id INTEGER, 
	manager_id INTEGER, 
	designation VARCHAR(100), 
	employee_code VARCHAR(30) NOT NULL, 
	joining_date DATE, 
	salary NUMERIC(12, 2), 
	employment_status ENUM('active','on_leave','inactive','terminated') NOT NULL, 
	employment_type ENUM('full_time','part_time','contract','intern') NOT NULL, 
	address TEXT, 
	emergency_contact_name VARCHAR(120), 
	emergency_contact_phone VARCHAR(30), 
	emergency_contact_relation VARCHAR(50), 
	date_of_birth DATE, 
	gender VARCHAR(20), 
	location VARCHAR(120), 
	skills JSON, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_employees PRIMARY KEY (id), 
	CONSTRAINT uq_employees_company_code UNIQUE (company_id, employee_code), 
	CONSTRAINT fk_employees_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT uq_employees_user_id UNIQUE (user_id), 
	CONSTRAINT fk_employees_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_employees_department_id FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE SET NULL, 
	CONSTRAINT fk_employees_manager_id FOREIGN KEY(manager_id) REFERENCES employees (id) ON DELETE SET NULL
);

CREATE INDEX ix_employees_company_status ON employees (company_id, employment_status);
CREATE INDEX ix_employees_department_id ON employees (department_id);

CREATE TABLE notifications (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	message TEXT NOT NULL, 
	type ENUM('task','project','invoice','payment','ticket','meeting','system') NOT NULL, 
	reference_type VARCHAR(40), 
	reference_id INTEGER, 
	is_read BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	CONSTRAINT pk_notifications PRIMARY KEY (id), 
	CONSTRAINT fk_notifications_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_notifications_user_read ON notifications (user_id, is_read);

CREATE TABLE refresh_tokens (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER NOT NULL, 
	token_hash VARCHAR(64) NOT NULL, 
	expires_at DATETIME NOT NULL, 
	revoked_at DATETIME, 
	user_agent VARCHAR(255), 
	ip_address VARCHAR(45), 
	created_at DATETIME NOT NULL, 
	CONSTRAINT pk_refresh_tokens PRIMARY KEY (id), 
	CONSTRAINT fk_refresh_tokens_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash)
);

CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens (user_id);

CREATE TABLE attendance_records (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	employee_id INTEGER NOT NULL, 
	attendance_date DATE NOT NULL, 
	check_in VARCHAR(5), 
	check_out VARCHAR(5), 
	status ENUM('present','absent','late','wfh','half_day','on_leave') NOT NULL, 
	notes VARCHAR(255), 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_attendance_records PRIMARY KEY (id), 
	CONSTRAINT uq_attendance_employee_date UNIQUE (employee_id, attendance_date), 
	CONSTRAINT fk_attendance_records_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_attendance_records_employee_id FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE INDEX ix_attendance_company_date ON attendance_records (company_id, attendance_date);

CREATE TABLE client_contacts (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	client_id INTEGER NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	email VARCHAR(255), 
	phone VARCHAR(30), 
	designation VARCHAR(100), 
	is_primary BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_client_contacts PRIMARY KEY (id), 
	CONSTRAINT fk_client_contacts_client_id FOREIGN KEY(client_id) REFERENCES clients (id) ON DELETE CASCADE
);

CREATE INDEX ix_client_contacts_client_id ON client_contacts (client_id);

CREATE TABLE leads (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	company_name VARCHAR(150) NOT NULL, 
	contact_name VARCHAR(120) NOT NULL, 
	email VARCHAR(255), 
	phone VARCHAR(30), 
	source ENUM('website','referral','social_media','advertisement','cold_call','email','other') NOT NULL, 
	status ENUM('new','contacted','qualified','proposal','negotiation','won','lost') NOT NULL, 
	priority ENUM('low','medium','high','urgent') NOT NULL, 
	estimated_value NUMERIC(14, 2) NOT NULL, 
	owner_id INTEGER, 
	notes TEXT, 
	last_contact_date DATE, 
	next_followup_date DATE, 
	converted_client_id INTEGER, 
	converted_at DATETIME, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_leads PRIMARY KEY (id), 
	CONSTRAINT fk_leads_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_leads_owner_id FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT fk_leads_converted_client_id FOREIGN KEY(converted_client_id) REFERENCES clients (id) ON DELETE SET NULL
);

CREATE INDEX ix_leads_company_status ON leads (company_id, status);
CREATE INDEX ix_leads_next_followup ON leads (next_followup_date);
CREATE INDEX ix_leads_owner_id ON leads (owner_id);

CREATE TABLE leave_requests (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	employee_id INTEGER NOT NULL, 
	leave_type ENUM('casual','sick','earned') NOT NULL, 
	start_date DATE NOT NULL, 
	end_date DATE NOT NULL, 
	days NUMERIC(5, 1) NOT NULL, 
	reason VARCHAR(500), 
	status ENUM('pending','approved','rejected','cancelled') NOT NULL, 
	decided_by INTEGER, 
	decided_at DATE, 
	rejection_reason VARCHAR(500), 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_leave_requests PRIMARY KEY (id), 
	CONSTRAINT fk_leave_requests_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_leave_requests_employee_id FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE, 
	CONSTRAINT fk_leave_requests_decided_by FOREIGN KEY(decided_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_leave_company_status ON leave_requests (company_id, status);
CREATE INDEX ix_leave_employee_id ON leave_requests (employee_id);

CREATE TABLE projects (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	client_id INTEGER, 
	name VARCHAR(150) NOT NULL, 
	description TEXT, 
	project_code VARCHAR(30) NOT NULL, 
	manager_id INTEGER, 
	start_date DATE, 
	end_date DATE, 
	budget NUMERIC(14, 2) NOT NULL, 
	status ENUM('planning','active','on_hold','completed','cancelled') NOT NULL, 
	progress SMALLINT NOT NULL, 
	created_by INTEGER, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_projects PRIMARY KEY (id), 
	CONSTRAINT uq_projects_company_code UNIQUE (company_id, project_code), 
	CONSTRAINT ck_projects_progress CHECK (progress BETWEEN 0 AND 100), 
	CONSTRAINT fk_projects_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_projects_client_id FOREIGN KEY(client_id) REFERENCES clients (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_projects_manager_id FOREIGN KEY(manager_id) REFERENCES employees (id) ON DELETE SET NULL, 
	CONSTRAINT fk_projects_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_projects_client_id ON projects (client_id);
CREATE INDEX ix_projects_company_status ON projects (company_id, status);
CREATE INDEX ix_projects_manager_id ON projects (manager_id);

CREATE TABLE documents (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	file_name VARCHAR(255) NOT NULL, 
	file_path VARCHAR(500) NOT NULL, 
	file_type VARCHAR(120) NOT NULL, 
	file_size BIGINT NOT NULL, 
	category ENUM('client','project','employee','contract','invoice','other') NOT NULL, 
	client_id INTEGER, 
	project_id INTEGER, 
	employee_id INTEGER, 
	uploaded_by INTEGER, 
	visibility ENUM('private','company','client') NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_documents PRIMARY KEY (id), 
	CONSTRAINT fk_documents_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_documents_client_id FOREIGN KEY(client_id) REFERENCES clients (id) ON DELETE SET NULL, 
	CONSTRAINT fk_documents_project_id FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL, 
	CONSTRAINT fk_documents_employee_id FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE SET NULL, 
	CONSTRAINT fk_documents_uploaded_by FOREIGN KEY(uploaded_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_documents_client_id ON documents (client_id);
CREATE INDEX ix_documents_company_category ON documents (company_id, category);
CREATE INDEX ix_documents_employee_id ON documents (employee_id);
CREATE INDEX ix_documents_project_id ON documents (project_id);

CREATE TABLE expenses (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	category ENUM('software','travel','office','marketing','salary','equipment','other') NOT NULL, 
	amount NUMERIC(14, 2) NOT NULL, 
	expense_date DATE NOT NULL, 
	employee_id INTEGER, 
	project_id INTEGER, 
	description TEXT, 
	attachment VARCHAR(500), 
	created_by INTEGER, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_expenses PRIMARY KEY (id), 
	CONSTRAINT ck_expenses_amount_positive CHECK (amount > 0), 
	CONSTRAINT fk_expenses_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_expenses_employee_id FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE SET NULL, 
	CONSTRAINT fk_expenses_project_id FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL, 
	CONSTRAINT fk_expenses_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_expenses_category ON expenses (category);
CREATE INDEX ix_expenses_company_date ON expenses (company_id, expense_date);
CREATE INDEX ix_expenses_project_id ON expenses (project_id);

CREATE TABLE invoices (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	invoice_number VARCHAR(40) NOT NULL, 
	client_id INTEGER NOT NULL, 
	project_id INTEGER, 
	quotation_id INTEGER, 
	issue_date DATE NOT NULL, 
	due_date DATE NOT NULL, 
	subtotal NUMERIC(14, 2) NOT NULL, 
	tax_amount NUMERIC(14, 2) NOT NULL, 
	additional_discount NUMERIC(14, 2) NOT NULL, 
	discount_amount NUMERIC(14, 2) NOT NULL, 
	total_amount NUMERIC(14, 2) NOT NULL, 
	paid_amount NUMERIC(14, 2) NOT NULL, 
	balance_amount NUMERIC(14, 2) NOT NULL, 
	status ENUM('draft','sent','partially_paid','paid','overdue','cancelled') NOT NULL, 
	payment_terms VARCHAR(60), 
	notes TEXT, 
	created_by INTEGER, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_invoices PRIMARY KEY (id), 
	CONSTRAINT uq_invoices_company_number UNIQUE (company_id, invoice_number), 
	CONSTRAINT fk_invoices_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_invoices_client_id FOREIGN KEY(client_id) REFERENCES clients (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_invoices_project_id FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL, 
	CONSTRAINT fk_invoices_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_invoices_client_id ON invoices (client_id);
CREATE INDEX ix_invoices_company_status ON invoices (company_id, status);
CREATE INDEX ix_invoices_due_date ON invoices (due_date);
CREATE INDEX ix_invoices_project_id ON invoices (project_id);
CREATE INDEX ix_invoices_status ON invoices (status);

CREATE TABLE lead_activities (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	lead_id INTEGER NOT NULL, 
	user_id INTEGER, 
	activity_type ENUM('call','email','meeting','note','follow_up') NOT NULL, 
	description TEXT NOT NULL, 
	activity_date DATETIME NOT NULL, 
	created_at DATETIME NOT NULL, 
	CONSTRAINT pk_lead_activities PRIMARY KEY (id), 
	CONSTRAINT fk_lead_activities_lead_id FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE CASCADE, 
	CONSTRAINT fk_lead_activities_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_lead_activities_lead_id ON lead_activities (lead_id);

CREATE TABLE meetings (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	client_id INTEGER, 
	project_id INTEGER, 
	created_by INTEGER, 
	meeting_date DATE NOT NULL, 
	start_time TIME NOT NULL, 
	end_time TIME, 
	meeting_type ENUM('client_meeting','internal','project_review','sales','support','other') NOT NULL, 
	meeting_link VARCHAR(500), 
	location VARCHAR(255), 
	status ENUM('scheduled','completed','cancelled') NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_meetings PRIMARY KEY (id), 
	CONSTRAINT fk_meetings_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_meetings_client_id FOREIGN KEY(client_id) REFERENCES clients (id) ON DELETE SET NULL, 
	CONSTRAINT fk_meetings_project_id FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL, 
	CONSTRAINT fk_meetings_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_meetings_client_id ON meetings (client_id);
CREATE INDEX ix_meetings_company_date ON meetings (company_id, meeting_date);
CREATE INDEX ix_meetings_project_id ON meetings (project_id);

CREATE TABLE milestones (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	project_id INTEGER NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	description TEXT, 
	due_date DATE, 
	status ENUM('pending','in_progress','completed','delayed') NOT NULL, 
	progress SMALLINT NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_milestones PRIMARY KEY (id), 
	CONSTRAINT ck_milestones_progress CHECK (progress BETWEEN 0 AND 100), 
	CONSTRAINT fk_milestones_project_id FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);

CREATE INDEX ix_milestones_project_id ON milestones (project_id);

CREATE TABLE project_members (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	project_id INTEGER NOT NULL, 
	employee_id INTEGER NOT NULL, 
	`role` VARCHAR(80), 
	joined_at DATETIME NOT NULL, 
	CONSTRAINT pk_project_members PRIMARY KEY (id), 
	CONSTRAINT uq_project_members_project_employee UNIQUE (project_id, employee_id), 
	CONSTRAINT fk_project_members_project_id FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	CONSTRAINT fk_project_members_employee_id FOREIGN KEY(employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

CREATE INDEX ix_project_members_employee_id ON project_members (employee_id);

CREATE TABLE quotations (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	quotation_number VARCHAR(40) NOT NULL, 
	client_id INTEGER NOT NULL, 
	project_id INTEGER, 
	issue_date DATE NOT NULL, 
	valid_until DATE, 
	subtotal NUMERIC(14, 2) NOT NULL, 
	tax_amount NUMERIC(14, 2) NOT NULL, 
	additional_discount NUMERIC(14, 2) NOT NULL, 
	discount_amount NUMERIC(14, 2) NOT NULL, 
	total_amount NUMERIC(14, 2) NOT NULL, 
	status ENUM('draft','sent','accepted','rejected','converted','expired') NOT NULL, 
	notes TEXT, 
	created_by INTEGER, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_quotations PRIMARY KEY (id), 
	CONSTRAINT uq_quotations_company_number UNIQUE (company_id, quotation_number), 
	CONSTRAINT fk_quotations_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_quotations_client_id FOREIGN KEY(client_id) REFERENCES clients (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_quotations_project_id FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL, 
	CONSTRAINT fk_quotations_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_quotations_client_id ON quotations (client_id);
CREATE INDEX ix_quotations_company_status ON quotations (company_id, status);

CREATE TABLE tickets (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	ticket_number VARCHAR(30) NOT NULL, 
	client_id INTEGER NOT NULL, 
	project_id INTEGER, 
	subject VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	category VARCHAR(60), 
	priority ENUM('low','medium','high','urgent') NOT NULL, 
	status ENUM('open','in_progress','waiting_for_client','resolved','closed') NOT NULL, 
	assigned_to INTEGER, 
	created_by INTEGER, 
	resolved_at DATETIME, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_tickets PRIMARY KEY (id), 
	CONSTRAINT uq_tickets_company_number UNIQUE (company_id, ticket_number), 
	CONSTRAINT fk_tickets_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_tickets_client_id FOREIGN KEY(client_id) REFERENCES clients (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_tickets_project_id FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE SET NULL, 
	CONSTRAINT fk_tickets_assigned_to FOREIGN KEY(assigned_to) REFERENCES users (id) ON DELETE SET NULL, 
	CONSTRAINT fk_tickets_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_tickets_assigned_to ON tickets (assigned_to);
CREATE INDEX ix_tickets_client_id ON tickets (client_id);
CREATE INDEX ix_tickets_company_status ON tickets (company_id, status);
CREATE INDEX ix_tickets_project_id ON tickets (project_id);
CREATE INDEX ix_tickets_status ON tickets (status);

CREATE TABLE invoice_items (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	invoice_id INTEGER NOT NULL, 
	description VARCHAR(500) NOT NULL, 
	quantity NUMERIC(12, 2) NOT NULL, 
	unit_price NUMERIC(14, 2) NOT NULL, 
	tax_rate NUMERIC(5, 2) NOT NULL, 
	discount NUMERIC(14, 2) NOT NULL, 
	total NUMERIC(14, 2) NOT NULL, 
	CONSTRAINT pk_invoice_items PRIMARY KEY (id), 
	CONSTRAINT fk_invoice_items_invoice_id FOREIGN KEY(invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
);

CREATE INDEX ix_invoice_items_invoice_id ON invoice_items (invoice_id);

CREATE TABLE meeting_participants (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	meeting_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	response_status ENUM('pending','accepted','declined') NOT NULL, 
	CONSTRAINT pk_meeting_participants PRIMARY KEY (id), 
	CONSTRAINT uq_meeting_participants_meeting_user UNIQUE (meeting_id, user_id), 
	CONSTRAINT fk_meeting_participants_meeting_id FOREIGN KEY(meeting_id) REFERENCES meetings (id) ON DELETE CASCADE, 
	CONSTRAINT fk_meeting_participants_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_meeting_participants_user_id ON meeting_participants (user_id);

CREATE TABLE payments (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	invoice_id INTEGER NOT NULL, 
	client_id INTEGER NOT NULL, 
	amount NUMERIC(14, 2) NOT NULL, 
	payment_date DATE NOT NULL, 
	payment_method ENUM('cash','bank_transfer','upi','card','cheque','other') NOT NULL, 
	reference_number VARCHAR(80), 
	notes TEXT, 
	created_by INTEGER, 
	created_at DATETIME NOT NULL, 
	CONSTRAINT pk_payments PRIMARY KEY (id), 
	CONSTRAINT ck_payments_amount_positive CHECK (amount > 0), 
	CONSTRAINT fk_payments_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_payments_invoice_id FOREIGN KEY(invoice_id) REFERENCES invoices (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_payments_client_id FOREIGN KEY(client_id) REFERENCES clients (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_payments_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_payments_client_id ON payments (client_id);
CREATE INDEX ix_payments_company_date ON payments (company_id, payment_date);
CREATE INDEX ix_payments_invoice_id ON payments (invoice_id);

CREATE TABLE quotation_items (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	quotation_id INTEGER NOT NULL, 
	description VARCHAR(500) NOT NULL, 
	quantity NUMERIC(12, 2) NOT NULL, 
	unit_price NUMERIC(14, 2) NOT NULL, 
	tax_rate NUMERIC(5, 2) NOT NULL, 
	discount NUMERIC(14, 2) NOT NULL, 
	total NUMERIC(14, 2) NOT NULL, 
	CONSTRAINT pk_quotation_items PRIMARY KEY (id), 
	CONSTRAINT fk_quotation_items_quotation_id FOREIGN KEY(quotation_id) REFERENCES quotations (id) ON DELETE CASCADE
);

CREATE INDEX ix_quotation_items_quotation_id ON quotation_items (quotation_id);

CREATE TABLE tasks (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	company_id INTEGER NOT NULL, 
	project_id INTEGER NOT NULL, 
	milestone_id INTEGER, 
	assigned_to INTEGER, 
	created_by INTEGER, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	priority ENUM('low','medium','high','urgent') NOT NULL, 
	status ENUM('todo','in_progress','review','completed') NOT NULL, 
	start_date DATE, 
	due_date DATE, 
	completed_at DATETIME, 
	checklist JSON, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_tasks PRIMARY KEY (id), 
	CONSTRAINT fk_tasks_company_id FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE RESTRICT, 
	CONSTRAINT fk_tasks_project_id FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	CONSTRAINT fk_tasks_milestone_id FOREIGN KEY(milestone_id) REFERENCES milestones (id) ON DELETE SET NULL, 
	CONSTRAINT fk_tasks_assigned_to FOREIGN KEY(assigned_to) REFERENCES employees (id) ON DELETE SET NULL, 
	CONSTRAINT fk_tasks_created_by FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_tasks_assigned_to ON tasks (assigned_to);
CREATE INDEX ix_tasks_company_status ON tasks (company_id, status);
CREATE INDEX ix_tasks_milestone_id ON tasks (milestone_id);
CREATE INDEX ix_tasks_project_id ON tasks (project_id);
CREATE INDEX ix_tasks_status ON tasks (status);

CREATE TABLE ticket_comments (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	ticket_id INTEGER NOT NULL, 
	user_id INTEGER, 
	comment TEXT NOT NULL, 
	is_internal BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	CONSTRAINT pk_ticket_comments PRIMARY KEY (id), 
	CONSTRAINT fk_ticket_comments_ticket_id FOREIGN KEY(ticket_id) REFERENCES tickets (id) ON DELETE CASCADE, 
	CONSTRAINT fk_ticket_comments_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_ticket_comments_ticket_id ON ticket_comments (ticket_id);

CREATE TABLE task_attachments (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	task_id INTEGER NOT NULL, 
	uploaded_by INTEGER, 
	file_name VARCHAR(255) NOT NULL, 
	file_path VARCHAR(500) NOT NULL, 
	file_type VARCHAR(120) NOT NULL, 
	file_size BIGINT NOT NULL, 
	created_at DATETIME NOT NULL, 
	CONSTRAINT pk_task_attachments PRIMARY KEY (id), 
	CONSTRAINT fk_task_attachments_task_id FOREIGN KEY(task_id) REFERENCES tasks (id) ON DELETE CASCADE, 
	CONSTRAINT fk_task_attachments_uploaded_by FOREIGN KEY(uploaded_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_task_attachments_task_id ON task_attachments (task_id);

CREATE TABLE task_comments (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	task_id INTEGER NOT NULL, 
	user_id INTEGER, 
	comment TEXT NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_task_comments PRIMARY KEY (id), 
	CONSTRAINT fk_task_comments_task_id FOREIGN KEY(task_id) REFERENCES tasks (id) ON DELETE CASCADE, 
	CONSTRAINT fk_task_comments_user_id FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_task_comments_task_id ON task_comments (task_id);

CREATE TABLE ticket_attachments (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	ticket_id INTEGER NOT NULL, 
	comment_id INTEGER, 
	uploaded_by INTEGER, 
	file_name VARCHAR(255) NOT NULL, 
	file_path VARCHAR(500) NOT NULL, 
	file_type VARCHAR(120) NOT NULL, 
	file_size BIGINT NOT NULL, 
	created_at DATETIME NOT NULL, 
	CONSTRAINT pk_ticket_attachments PRIMARY KEY (id), 
	CONSTRAINT fk_ticket_attachments_ticket_id FOREIGN KEY(ticket_id) REFERENCES tickets (id) ON DELETE CASCADE, 
	CONSTRAINT fk_ticket_attachments_comment_id FOREIGN KEY(comment_id) REFERENCES ticket_comments (id) ON DELETE SET NULL, 
	CONSTRAINT fk_ticket_attachments_uploaded_by FOREIGN KEY(uploaded_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_ticket_attachments_ticket_id ON ticket_attachments (ticket_id);

ALTER TABLE users ADD CONSTRAINT fk_users_client_id FOREIGN KEY(client_id) REFERENCES clients (id) ON DELETE SET NULL;
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_quotation_id FOREIGN KEY(quotation_id) REFERENCES quotations (id) ON DELETE SET NULL;
SET FOREIGN_KEY_CHECKS = 1;
