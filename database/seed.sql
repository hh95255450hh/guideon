-- GUIDEON Seed Data
-- Passwords are all: Password123!  (bcrypt hash)

INSERT INTO users (id, name, email, password_hash, role, phone, is_active, email_verified) VALUES
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'Admin User',
  'admin@guideon.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'admin',
  '+96891000001',
  true,
  true
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'Muscat Adventures LLC',
  'company@muscatadventures.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'company',
  '+96891000002',
  true,
  true
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'Ahmed Al-Rashidi',
  'guide@guideon.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'guide',
  '+96891000003',
  true,
  true
),
(
  'a1b2c3d4-0004-0004-0004-000000000004',
  'Sara Johnson',
  'tourist@example.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'tourist',
  '+1234567890',
  true,
  true
);

INSERT INTO companies (id, user_id, company_name, description, license_number, website, verified) VALUES
(
  'c0000001-0001-0001-0001-000000000001',
  'a1b2c3d4-0002-0002-0002-000000000002',
  'Muscat Adventures',
  'Premier adventure tourism company in Oman with 10+ years of experience.',
  'OMTOUR-2024-001',
  'https://muscatadventures.om',
  true
);

INSERT INTO tours (id, company_id, guide_id, title, description, location, region, price, duration_days, max_participants, category, difficulty, includes, excludes, meeting_point, status) VALUES
(
  'b0000001-0001-0001-0001-000000000001',
  'c0000001-0001-0001-0001-000000000001',
  'a1b2c3d4-0003-0003-0003-000000000003',
  'Wahiba Sands Desert Safari',
  'Experience the golden dunes of the Wahiba Sands in this unforgettable 2-day desert adventure. Camp under the stars, ride camels, and explore traditional Bedouin culture.',
  'Wahiba Sands',
  'Al Sharqiyah',
  150.00,
  2,
  12,
  'Desert',
  'moderate',
  ARRAY['Transport from Muscat', 'Meals (all)', 'Tent accommodation', 'Camel ride', 'Dune bashing'],
  ARRAY['Personal travel insurance', 'Alcoholic beverages', 'Tips'],
  'Muscat Grand Mall, Parking Level 1',
  'active'
),
(
  'b0000001-0002-0002-0002-000000000002',
  'c0000001-0001-0001-0001-000000000001',
  'a1b2c3d4-0003-0003-0003-000000000003',
  'Wadi Shab Trekking & Swimming',
  'Trek through the stunning Wadi Shab gorge, swim in crystal-clear pools, and discover hidden waterfalls in one of Oman''s most beautiful wadis.',
  'Wadi Shab',
  'Al Sharqiyah',
  75.00,
  1,
  15,
  'Adventure',
  'moderate',
  ARRAY['Transport from Muscat', 'Lunch', 'Professional guide', 'Life jackets'],
  ARRAY['Personal travel insurance', 'Snacks', 'Tips'],
  'Muscat International Hotel',
  'active'
),
(
  'b0000001-0003-0003-0003-000000000003',
  'c0000001-0001-0001-0001-000000000001',
  'a1b2c3d4-0003-0003-0003-000000000003',
  'Muscat City Heritage Tour',
  'Discover the rich history and culture of Muscat. Visit the Sultan Qaboos Grand Mosque, Mutrah Souq, Al Alam Palace, and the National Museum.',
  'Muscat',
  'Muscat Governorate',
  45.00,
  1,
  20,
  'Cultural',
  'easy',
  ARRAY['Air-conditioned transport', 'Professional English guide', 'Entrance fees', 'Bottled water'],
  ARRAY['Meals', 'Personal shopping', 'Tips'],
  'Muscat Grand Hyatt Hotel',
  'active'
);

INSERT INTO tour_availability (tour_id, date, available_spots) VALUES
('b0000001-0001-0001-0001-000000000001', CURRENT_DATE + 7,  12),
('b0000001-0001-0001-0001-000000000001', CURRENT_DATE + 14, 12),
('b0000001-0001-0001-0001-000000000001', CURRENT_DATE + 21, 10),
('b0000001-0002-0002-0002-000000000002', CURRENT_DATE + 3,  15),
('b0000001-0002-0002-0002-000000000002', CURRENT_DATE + 10, 15),
('b0000001-0002-0002-0002-000000000002', CURRENT_DATE + 17, 12),
('b0000001-0003-0003-0003-000000000003', CURRENT_DATE + 2,  20),
('b0000001-0003-0003-0003-000000000003', CURRENT_DATE + 5,  20),
('b0000001-0003-0003-0003-000000000003', CURRENT_DATE + 9,  18);

INSERT INTO tour_images (tour_id, url, is_primary) VALUES
('b0000001-0001-0001-0001-000000000001', 'https://images.unsplash.com/photo-1547036967-23d11aacaee0', true),
('b0000001-0001-0001-0001-000000000001', 'https://images.unsplash.com/photo-1509316785289-025f5b846b35', false),
('b0000001-0002-0002-0002-000000000002', 'https://images.unsplash.com/photo-1504198322253-cfa87a0ff60f', true),
('b0000001-0003-0003-0003-000000000003', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64', true);
