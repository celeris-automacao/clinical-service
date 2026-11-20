ALTER TABLE care_packages
  ADD COLUMN promotion_images text[] NOT NULL DEFAULT '{}';
