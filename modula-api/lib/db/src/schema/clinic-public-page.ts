import { pgTable, serial, text, timestamp, integer, boolean, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";

export const clinicPublicPagesTable = pgTable(
  "clinic_public_pages",
  {
    id: serial("id").primaryKey(),
    clinicId: integer("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    published: boolean("published").notNull().default(false),
    tagline: text("tagline"),
    about: text("about"),
    coverImageUrl: text("cover_image_url"),
    address: text("address"),
    phone: text("phone"),
    contactEmail: text("contact_email"),
    socialLinks: jsonb("social_links").$type<Record<string, string>>(),
    businessHours: jsonb("business_hours").$type<Record<string, string>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    unique("clinic_public_pages_clinic_id_unique").on(t.clinicId),
    unique("clinic_public_pages_slug_unique").on(t.slug),
  ]
);

export const clinicPublicServicesTable = pgTable("clinic_public_services", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id")
    .notNull()
    .references(() => clinicsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clinicGalleryPhotosTable = pgTable("clinic_gallery_photos", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id")
    .notNull()
    .references(() => clinicsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: text("caption"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClinicPublicPageSchema = createInsertSchema(clinicPublicPagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertClinicPublicServiceSchema = createInsertSchema(clinicPublicServicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertClinicGalleryPhotoSchema = createInsertSchema(clinicGalleryPhotosTable).omit({
  id: true,
  createdAt: true,
});

export type InsertClinicPublicPage = z.infer<typeof insertClinicPublicPageSchema>;
export type InsertClinicPublicService = z.infer<typeof insertClinicPublicServiceSchema>;
export type InsertClinicGalleryPhoto = z.infer<typeof insertClinicGalleryPhotoSchema>;
export type ClinicPublicPage = typeof clinicPublicPagesTable.$inferSelect;
export type ClinicPublicService = typeof clinicPublicServicesTable.$inferSelect;
export type ClinicGalleryPhoto = typeof clinicGalleryPhotosTable.$inferSelect;
