-- Get the existing organization ID and a valid user ID
DO $$
DECLARE
    v_org_id uuid;
    admin_user_id uuid;
BEGIN
    -- Get the organization ID for Sunset Elementary PTO
    SELECT id INTO v_org_id FROM organizations WHERE name = 'Sunset Elementary PTO' LIMIT 1;
    
    -- Get the admin user ID from profiles table
    SELECT id INTO admin_user_id FROM profiles WHERE org_id = v_org_id AND role = 'admin' LIMIT 1;
    
    -- If no admin user exists, create one
    IF admin_user_id IS NULL THEN
        INSERT INTO profiles (id, full_name, email, role, org_id, created_at, approved)
        VALUES (gen_random_uuid(), 'Admin User', 'admin@sunsetpto.com', 'admin', v_org_id, NOW(), true)
        RETURNING id INTO admin_user_id;
    END IF;
    
    -- Insert test data for fundraising campaigns
    INSERT INTO fundraising_campaigns (
        id, org_id, name, description, goal_amount, raised_amount,
        start_date, end_date, campaign_type, status, associated_events,
        donation_methods, created_by, created_at, updated_at
    ) VALUES
        (gen_random_uuid(), v_org_id, 'Annual Fundraiser 2024', 'Main annual fundraising campaign', 50000.00, 35000.00, '2024-01-01', '2024-12-31', 'annual', 'active', '["Annual Gala", "Silent Auction"]', '["credit_card", "check", "cash", "bank_transfer"]', admin_user_id, NOW(), NOW()),
        (gen_random_uuid(), v_org_id, 'Spring Book Fair', 'Book fair fundraiser', 10000.00, 7500.00, '2024-03-01', '2024-03-15', 'event', 'active', '["Book Fair"]', '["credit_card", "cash", "check", "bank_transfer"]', admin_user_id, NOW(), NOW()),
        (gen_random_uuid(), v_org_id, 'Teacher Wish List', 'Support classroom needs', 5000.00, 3000.00, '2024-01-01', '2024-06-30', 'ongoing', 'active', '[]', '["credit_card", "check", "bank_transfer"]', admin_user_id, NOW(), NOW()),
        (gen_random_uuid(), v_org_id, 'Corporate Sponsorship Program', 'Business partnership program', 25000.00, 15000.00, '2024-01-01', '2024-12-31', 'ongoing', 'active', '["Corporate Breakfast", "Sponsor Recognition"]', '["bank_transfer", "check"]', admin_user_id, NOW(), NOW());

    -- Insert test data for donor profiles (individuals)
    INSERT INTO donor_profiles (
        id, org_id, donor_name, donor_email, donor_phone,
        total_donations, first_donation_date, last_donation_date,
        donation_count, preferred_donation_type, preferred_payment_method,
        is_recurring, notes, created_at, updated_at
    ) VALUES
        (gen_random_uuid(), v_org_id, 'John Smith', 'john.smith@email.com', '555-0101', 1500.00, '2024-01-15', '2024-03-01', 3, 'monetary', 'credit_card', true, 'Monthly donor', NOW(), NOW()),
        (gen_random_uuid(), v_org_id, 'Sarah Johnson', 'sarah.j@email.com', '555-0102', 2500.00, '2024-01-20', '2024-03-15', 2, 'monetary', 'check', false, 'Board member', NOW(), NOW()),
        (gen_random_uuid(), v_org_id, 'Mike Brown', 'mike.b@email.com', '555-0103', 500.00, '2024-02-01', '2024-02-01', 1, 'time', 'cash', false, 'Regular volunteer', NOW(), NOW());

    -- Insert test data for business donor profiles
    INSERT INTO donor_profiles (
        id, org_id, donor_name, donor_email, donor_phone,
        total_donations, first_donation_date, last_donation_date,
        donation_count, preferred_donation_type, preferred_payment_method,
        is_recurring, notes, created_at, updated_at
    ) VALUES
        (gen_random_uuid(), v_org_id, 'Local Business Association', 'sponsors@lba.org', '555-0201', 10000.00, '2024-01-10', '2024-03-01', 2, 'monetary', 'bank_transfer', true, 'Quarterly sponsor', NOW(), NOW()),
        (gen_random_uuid(), v_org_id, 'Tech Solutions Inc.', 'community@techsolutions.com', '555-0202', 5000.00, '2024-02-01', '2024-02-01', 1, 'monetary', 'check', false, 'Annual sponsor', NOW(), NOW()),
        (gen_random_uuid(), v_org_id, 'Community Bookstore', 'events@communitybooks.com', '555-0203', 3000.00, '2024-01-15', '2024-03-01', 2, 'supplies', 'cash', false, 'Book fair sponsor', NOW(), NOW());

    -- Insert test data for donations (individuals)
    INSERT INTO donations (
        id, org_id, fundraiser_id, donor_name, donor_email, donor_phone,
        donation_type, amount, description, donation_date, is_recurring,
        frequency, category, payment_method, status, created_by,
        created_at, updated_at
    ) VALUES
        (gen_random_uuid(), v_org_id, 
        (SELECT id FROM fundraising_campaigns WHERE name = 'Annual Fundraiser 2024' AND org_id = v_org_id LIMIT 1),
        'John Smith', 'john.smith@email.com', '555-0101',
        'monetary', 500.00, 'Monthly donation', '2024-01-15', true,
        'monthly', 'general', 'credit_card', 'completed', admin_user_id,
        NOW(), NOW()),
        (gen_random_uuid(), v_org_id,
        (SELECT id FROM fundraising_campaigns WHERE name = 'Spring Book Fair' AND org_id = v_org_id LIMIT 1),
        'Sarah Johnson', 'sarah.j@email.com', '555-0102',
        'monetary', 1000.00, 'Book fair donation', '2024-03-01', false,
        'annually', 'event', 'check', 'completed', admin_user_id,
        NOW(), NOW()),
        (gen_random_uuid(), v_org_id,
        (SELECT id FROM fundraising_campaigns WHERE name = 'Teacher Wish List' AND org_id = v_org_id LIMIT 1),
        'Mike Brown', 'mike.b@email.com', '555-0103',
        'time', 0.00, 'Classroom setup', '2024-02-01', false,
        'annually', 'volunteer', 'cash', 'completed', admin_user_id,
        NOW(), NOW());

    -- Insert test data for business donations
    INSERT INTO donations (
        id, org_id, fundraiser_id, donor_name, donor_email, donor_phone,
        donation_type, amount, description, donation_date, is_recurring,
        frequency, category, payment_method, status, created_by,
        created_at, updated_at
    ) VALUES
        (gen_random_uuid(), v_org_id,
        (SELECT id FROM fundraising_campaigns WHERE name = 'Corporate Sponsorship Program' AND org_id = v_org_id LIMIT 1),
        'Local Business Association', 'sponsors@lba.org', '555-0201',
        'monetary', 5000.00, 'Q1 sponsorship payment', '2024-01-10', true,
        'quarterly', 'sponsorship', 'bank_transfer', 'completed', admin_user_id,
        NOW(), NOW()),
        (gen_random_uuid(), v_org_id,
        (SELECT id FROM fundraising_campaigns WHERE name = 'Annual Fundraiser 2024' AND org_id = v_org_id LIMIT 1),
        'Tech Solutions Inc.', 'community@techsolutions.com', '555-0202',
        'monetary', 5000.00, 'Annual sponsorship', '2024-02-01', false,
        'annually', 'sponsorship', 'check', 'completed', admin_user_id,
        NOW(), NOW()),
        (gen_random_uuid(), v_org_id,
        (SELECT id FROM fundraising_campaigns WHERE name = 'Spring Book Fair' AND org_id = v_org_id LIMIT 1),
        'Community Bookstore', 'events@communitybooks.com', '555-0203',
        'supplies', 0.00, 'Book donations', '2024-03-01', false,
        'annually', 'in_kind', 'cash', 'completed', admin_user_id,
        NOW(), NOW());

    -- Insert test data for volunteer hours
    INSERT INTO volunteer_hours (
        id, org_id, fundraiser_id, volunteer_id, hours,
        activity_description, date, status, created_by,
        created_at, updated_at
    ) VALUES
        (gen_random_uuid(), v_org_id,
        (SELECT id FROM fundraising_campaigns WHERE name = 'Annual Fundraiser 2024' AND org_id = v_org_id LIMIT 1),
        (SELECT id FROM donor_profiles WHERE donor_name = 'Mike Brown' AND org_id = v_org_id LIMIT 1),
        4.0, 'Event setup and cleanup', '2024-01-15', 'completed',
        admin_user_id, NOW(), NOW()),
        (gen_random_uuid(), v_org_id,
        (SELECT id FROM fundraising_campaigns WHERE name = 'Spring Book Fair' AND org_id = v_org_id LIMIT 1),
        (SELECT id FROM donor_profiles WHERE donor_name = 'Mike Brown' AND org_id = v_org_id LIMIT 1),
        6.0, 'Book fair organization', '2024-03-01', 'completed',
        admin_user_id, NOW(), NOW());

    -- Insert test data for supply donations
    INSERT INTO supply_donations (
        id, org_id, fundraiser_id, donor_id, item_name,
        quantity, estimated_value, category, condition,
        notes, donation_date, status, created_by,
        created_at, updated_at
    ) VALUES
        (gen_random_uuid(), v_org_id,
        (SELECT id FROM fundraising_campaigns WHERE name = 'Annual Fundraiser 2024' AND org_id = v_org_id LIMIT 1),
        (SELECT id FROM donor_profiles WHERE donor_name = 'Sarah Johnson' AND org_id = v_org_id LIMIT 1),
        'Silent Auction Items', 5, 1000.00, 'auction',
        'new', 'Local business donations', '2024-01-20', 'received',
        admin_user_id, NOW(), NOW()),
        (gen_random_uuid(), v_org_id,
        (SELECT id FROM fundraising_campaigns WHERE name = 'Teacher Wish List' AND org_id = v_org_id LIMIT 1),
        (SELECT id FROM donor_profiles WHERE donor_name = 'John Smith' AND org_id = v_org_id LIMIT 1),
        'Classroom Supplies', 20, 500.00, 'supplies',
        'new', 'Basic classroom materials', '2024-02-15', 'received',
        admin_user_id, NOW(), NOW()),
        (gen_random_uuid(), v_org_id,
        (SELECT id FROM fundraising_campaigns WHERE name = 'Spring Book Fair' AND org_id = v_org_id LIMIT 1),
        (SELECT id FROM donor_profiles WHERE donor_name = 'Community Bookstore' AND org_id = v_org_id LIMIT 1),
        'Books', 100, 3000.00, 'books',
        'new', 'Book fair inventory', '2024-03-01', 'received',
        admin_user_id, NOW(), NOW());

    -- Insert test data for fundraisers (for frontend display)
    INSERT INTO fundraisers (
        id, org_id, title, description, goal, current_total, type, is_active, start_date, end_date, created_by, created_at, updated_at
    ) VALUES
        (gen_random_uuid(), v_org_id, 'Annual Fundraiser 2024', 'Main annual fundraising campaign', 50000.00, 35000.00, 'donation', true, '2024-01-01', '2024-12-31', admin_user_id, NOW(), NOW()),
        (gen_random_uuid(), v_org_id, 'Spring Book Fair', 'Book fair fundraiser', 10000.00, 7500.00, 'donation', true, '2024-03-01', '2024-03-15', admin_user_id, NOW(), NOW()),
        (gen_random_uuid(), v_org_id, 'Teacher Wish List', 'Support classroom needs', 5000.00, 3000.00, 'donation', true, '2024-01-01', '2024-06-30', admin_user_id, NOW(), NOW()),
        (gen_random_uuid(), v_org_id, 'Corporate Sponsorship Program', 'Business partnership program', 25000.00, 15000.00, 'donation', true, '2024-01-01', '2024-12-31', admin_user_id, NOW(), NOW());
END $$; 