CREATE TABLE care_package_promotion_uploads (
  object_path text PRIMARY KEY,
  clinic_id integer NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  uploaded_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
