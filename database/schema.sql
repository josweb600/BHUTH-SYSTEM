-- ============================================================================
-- BULE HORA UNIVERSITY TEACHING HOSPITALS
-- DIGITAL HOSPITAL MANAGEMENT SYSTEM - DATABASE SCHEMA
-- PostgreSQL 14.x Compatible
-- Version: 1.0
-- Date: June 2025
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS & AUTHENTICATION TABLES
-- ============================================================================

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Physician', 'Nurse', 'Pharmacist', 'Lab_Technician', 'Radiologist', 'Receptionist', 'Accountant')),
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    mfa_enabled BOOLEAN DEFAULT true,
    mfa_secret VARCHAR(255),
    last_login TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    access_token VARCHAR(1000) NOT NULL,
    refresh_token VARCHAR(1000) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_sessions_user (user_id)
);

CREATE TABLE audit_logs (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'READ', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PATIENT TABLES
-- ============================================================================

CREATE TABLE patients (
    patient_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mrn VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('M', 'F', 'Other')),
    email VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    address TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    postal_code VARCHAR(10),
    country VARCHAR(50) DEFAULT 'Ethiopia',
    blood_type VARCHAR(5) CHECK (blood_type IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Deceased')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patient_contacts (
    contact_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    contact_type VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    relationship VARCHAR(50),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patient_insurance (
    insurance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    insurance_provider VARCHAR(100),
    policy_number VARCHAR(50) NOT NULL,
    group_number VARCHAR(50),
    start_date DATE,
    end_date DATE,
    coverage_percentage NUMERIC(5,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patient_allergies (
    allergy_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    allergen VARCHAR(100) NOT NULL,
    reaction VARCHAR(255),
    severity VARCHAR(20) CHECK (severity IN ('Mild', 'Moderate', 'Severe')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MEDICAL RECORDS TABLES
-- ============================================================================

CREATE TABLE medical_records (
    record_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    physician_id UUID NOT NULL REFERENCES users(user_id),
    visit_date TIMESTAMP WITH TIME ZONE NOT NULL,
    chief_complaint TEXT,
    history_of_present_illness TEXT,
    physical_examination TEXT,
    diagnosis TEXT NOT NULL,
    treatment_plan TEXT,
    medications_prescribed TEXT,
    follow_up_date DATE,
    status VARCHAR(20) DEFAULT 'Completed' CHECK (status IN ('Draft', 'Completed', 'Archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vital_signs (
    vital_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID NOT NULL REFERENCES medical_records(record_id) ON DELETE CASCADE,
    blood_pressure VARCHAR(20),
    systolic_bp INTEGER,
    diastolic_bp INTEGER,
    temperature NUMERIC(4,1),
    pulse_rate INTEGER,
    respiratory_rate INTEGER,
    oxygen_saturation NUMERIC(4,1),
    weight NUMERIC(6,2),
    height NUMERIC(5,2),
    bmi NUMERIC(5,2),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- APPOINTMENT TABLES
-- ============================================================================

CREATE TABLE appointments (
    appointment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(user_id),
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled', 'No_Show', 'Rescheduled')),
    appointment_type VARCHAR(50),
    notes TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appointment_slots (
    slot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES users(user_id),
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- LABORATORY TABLES
-- ============================================================================

CREATE TABLE lab_tests (
    test_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    ordered_by UUID NOT NULL REFERENCES users(user_id),
    test_type VARCHAR(100) NOT NULL,
    clinical_indication TEXT,
    specimen_type VARCHAR(50),
    request_date TIMESTAMP WITH TIME ZONE NOT NULL,
    specimen_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In_Progress', 'Completed', 'Cancelled')),
    priority VARCHAR(20) DEFAULT 'Normal' CHECK (priority IN ('Routine', 'Normal', 'Urgent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lab_results (
    result_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID NOT NULL REFERENCES lab_tests(test_id) ON DELETE CASCADE,
    result_date TIMESTAMP WITH TIME ZONE NOT NULL,
    result_text TEXT,
    result_value NUMERIC(10,2),
    result_unit VARCHAR(50),
    reference_range VARCHAR(100),
    normal_flag BOOLEAN,
    technician_id UUID REFERENCES users(user_id),
    verified_by UUID REFERENCES users(user_id),
    verified_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- RADIOLOGY TABLES
-- ============================================================================

CREATE TABLE radiology_orders (
    order_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    ordered_by UUID NOT NULL REFERENCES users(user_id),
    imaging_type VARCHAR(100) NOT NULL,
    body_part VARCHAR(100),
    clinical_indication TEXT,
    modality VARCHAR(50),
    order_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Scheduled', 'In_Progress', 'Completed', 'Cancelled')),
    priority VARCHAR(20) DEFAULT 'Normal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE radiology_findings (
    finding_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES radiology_orders(order_id) ON DELETE CASCADE,
    finding_date TIMESTAMP WITH TIME ZONE NOT NULL,
    radiologist_id UUID NOT NULL REFERENCES users(user_id),
    findings_text TEXT,
    impression TEXT,
    recommendations TEXT,
    comparison_study VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dicom_images (
    image_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES radiology_orders(order_id) ON DELETE CASCADE,
    series_uid VARCHAR(100),
    image_uid VARCHAR(100) UNIQUE,
    file_path VARCHAR(255),
    file_size BIGINT,
    modality VARCHAR(50),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PHARMACY TABLES
-- ============================================================================

CREATE TABLE medications (
    medication_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    dosage VARCHAR(100),
    unit VARCHAR(50),
    route VARCHAR(50) CHECK (route IN ('Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhalation', 'Rectal')),
    manufacturer VARCHAR(100),
    unit_price NUMERIC(10,2),
    stock_quantity INTEGER DEFAULT 0,
    reorder_level INTEGER,
    max_stock INTEGER,
    expiry_date DATE,
    is_controlled BOOLEAN DEFAULT false,
    contraindications TEXT,
    side_effects TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE drug_interactions (
    interaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_1_id UUID NOT NULL REFERENCES medications(medication_id),
    medication_2_id UUID NOT NULL REFERENCES medications(medication_id),
    severity VARCHAR(20) CHECK (severity IN ('Mild', 'Moderate', 'Severe', 'Contraindicated')),
    interaction_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE prescriptions (
    prescription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    record_id UUID NOT NULL REFERENCES medical_records(record_id),
    medication_id UUID NOT NULL REFERENCES medications(medication_id),
    prescribed_by UUID NOT NULL REFERENCES users(user_id),
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(100),
    quantity INTEGER,
    refills_allowed INTEGER DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled', 'Dispensed')),
    special_instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE medication_dispensing (
    dispensing_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(prescription_id),
    dispensed_by UUID NOT NULL REFERENCES users(user_id),
    dispensed_date TIMESTAMP WITH TIME ZONE NOT NULL,
    quantity_dispensed INTEGER,
    expiry_date DATE,
    batch_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- BILLING TABLES
-- ============================================================================

CREATE TABLE bills (
    bill_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_number VARCHAR(50) UNIQUE NOT NULL,
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    bill_date DATE NOT NULL,
    service_date DATE,
    total_amount NUMERIC(10,2) NOT NULL,
    discount_amount NUMERIC(10,2) DEFAULT 0,
    insurance_amount NUMERIC(10,2) DEFAULT 0,
    patient_responsibility NUMERIC(10,2) NOT NULL,
    paid_amount NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Partial', 'Paid', 'Cancelled')),
    due_date DATE,
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bill_items (
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID NOT NULL REFERENCES bills(bill_id) ON DELETE CASCADE,
    service_code VARCHAR(50),
    description VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID NOT NULL REFERENCES bills(bill_id) ON DELETE CASCADE,
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    payment_method VARCHAR(50) CHECK (payment_method IN ('Cash', 'Credit_Card', 'Debit_Card', 'Bank_Transfer', 'Mobile_Money')),
    transaction_ref VARCHAR(100),
    received_by UUID NOT NULL REFERENCES users(user_id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INVENTORY TABLES
-- ============================================================================

CREATE TABLE inventory_items (
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code VARCHAR(50) UNIQUE NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    supplier_id UUID,
    unit_price NUMERIC(10,2),
    quantity_in_stock INTEGER DEFAULT 0,
    reorder_level INTEGER,
    max_stock INTEGER,
    expiry_date DATE,
    location VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES inventory_items(item_id),
    transaction_type VARCHAR(50) CHECK (transaction_type IN ('Purchase', 'Consumption', 'Return', 'Adjustment', 'Expiry')),
    quantity INTEGER NOT NULL,
    reference_id VARCHAR(50),
    performed_by UUID NOT NULL REFERENCES users(user_id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- STAFF TABLES
-- ============================================================================

CREATE TABLE staff_credentials (
    credential_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    credential_type VARCHAR(100),
    license_number VARCHAR(50) UNIQUE,
    issuing_authority VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(user_id),
    verified_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff_schedule (
    schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_type VARCHAR(50) CHECK (shift_type IN ('Morning', 'Evening', 'Night')),
    start_time TIME,
    end_time TIME,
    status VARCHAR(20) DEFAULT 'Scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_patients_mrn ON patients(mrn);
CREATE INDEX idx_patients_email ON patients(email);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_medical_records_patient ON medical_records(patient_id);
CREATE INDEX idx_medical_records_date ON medical_records(visit_date);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_lab_tests_patient ON lab_tests(patient_id);
CREATE INDEX idx_lab_tests_status ON lab_tests(status);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_status ON prescriptions(status);
CREATE INDEX idx_bills_patient ON bills(patient_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_payments_bill ON payments(bill_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

CREATE VIEW patient_demographics AS
SELECT 
    p.patient_id,
    p.mrn,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    p.date_of_birth,
    EXTRACT(YEAR FROM AGE(p.date_of_birth)) AS age,
    p.gender,
    p.phone,
    p.email,
    p.status
FROM patients p;

CREATE VIEW active_appointments AS
SELECT 
    a.appointment_id,
    p.mrn,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
    u.department,
    a.appointment_date,
    a.status
FROM appointments a
JOIN patients p ON a.patient_id = p.patient_id
JOIN users u ON a.doctor_id = u.user_id
WHERE a.status = 'Scheduled'
ORDER BY a.appointment_date;

CREATE VIEW pending_lab_tests AS
SELECT 
    lt.test_id,
    p.mrn,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    lt.test_type,
    lt.request_date,
    lt.priority
FROM lab_tests lt
JOIN patients p ON lt.patient_id = p.patient_id
WHERE lt.status IN ('Pending', 'In_Progress')
ORDER BY lt.priority DESC, lt.request_date;

CREATE VIEW outstanding_bills AS
SELECT 
    b.bill_id,
    b.bill_number,
    p.mrn,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    b.bill_date,
    b.patient_responsibility,
    b.paid_amount,
    (b.patient_responsibility - b.paid_amount) AS outstanding_amount,
    b.status,
    b.due_date
FROM bills b
JOIN patients p ON b.patient_id = p.patient_id
WHERE b.status IN ('Pending', 'Partial')
ORDER BY b.due_date;

-- ============================================================================
-- TRIGGERS FOR AUDIT & DATA INTEGRITY
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_patients_updated
BEFORE UPDATE ON patients
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_users_updated
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_bills_updated
BEFORE UPDATE ON bills
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- INITIAL DATA & SETUP
-- ============================================================================

-- Create default admin user (password should be changed immediately)
INSERT INTO users (employee_id, first_name, last_name, email, role, password_hash, department, is_active)
VALUES (
    'ADM001',
    'System',
    'Administrator',
    'admin@hospital.buho.edu.et',
    'Admin',
    crypt('ChangeMe123!', gen_salt('bf')),
    'Administration',
    true
) ON CONFLICT DO NOTHING;

GRANT USAGE ON SCHEMA public TO postgres;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO postgres;

COMMIT;
