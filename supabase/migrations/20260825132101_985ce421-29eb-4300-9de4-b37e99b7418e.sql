-- ENUM
CREATE TYPE public.product_status AS ENUM ('draft', 'published', 'archived');

-- CATEGORIES
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_sr text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER categories_set_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BRANDS
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brands TO anon;
GRANT SELECT ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view brands" ON public.brands FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage brands" ON public.brands FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER brands_set_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  title text NOT NULL,
  model text,
  description text,
  serial_number text,
  production_year integer,
  condition text,
  material text,
  country_of_origin text,
  provenance_notes text,
  has_original_box boolean NOT NULL DEFAULT false,
  has_documents boolean NOT NULL DEFAULT false,
  status public.product_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_production_year_valid CHECK (production_year IS NULL OR (production_year BETWEEN 1500 AND 2100))
);
CREATE INDEX products_seller_id_idx ON public.products(seller_id);
CREATE INDEX products_status_idx ON public.products(status);
CREATE INDEX products_category_id_idx ON public.products(category_id);

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published products" ON public.products FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "Sellers can view their own products" ON public.products FOR SELECT TO authenticated USING (auth.uid() = seller_id);
CREATE POLICY "Admins can view all products" ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sellers can create their own products" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller'));
CREATE POLICY "Sellers can update their own products" ON public.products FOR UPDATE TO authenticated USING (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller')) WITH CHECK (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller'));
CREATE POLICY "Sellers can delete their own draft products" ON public.products FOR DELETE TO authenticated USING (auth.uid() = seller_id AND status = 'draft');
CREATE POLICY "Admins can manage all products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRODUCT IMAGES
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_images_product_id_idx ON public.product_images(product_id);
CREATE UNIQUE INDEX product_images_one_cover_idx ON public.product_images(product_id) WHERE is_cover;

GRANT SELECT ON public.product_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view images of published products" ON public.product_images FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'published'));
CREATE POLICY "Sellers can view their own product images" ON public.product_images FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()));
CREATE POLICY "Admins can view all product images" ON public.product_images FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sellers can add their own product images" ON public.product_images FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()));
CREATE POLICY "Sellers can update their own product images" ON public.product_images FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()));
CREATE POLICY "Sellers can delete their own product images" ON public.product_images FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()));
CREATE TRIGGER product_images_set_updated_at BEFORE UPDATE ON public.product_images FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SEED
INSERT INTO public.categories (slug, name_en, name_sr, sort_order) VALUES
  ('watches', 'Watches', 'Satovi', 1),
  ('jewelry', 'Jewelry', 'Nakit', 2),
  ('collectibles', 'Collectibles', 'Kolekcionarstvo', 3),
  ('fashion', 'Limited-edition fashion', 'Limitirana moda', 4);

INSERT INTO public.brands (slug, name) VALUES
  ('audemars-piguet', 'Audemars Piguet'),
  ('boucheron', 'Boucheron'),
  ('bulgari', 'Bulgari'),
  ('cartier', 'Cartier'),
  ('chanel', 'Chanel'),
  ('dior', 'Dior'),
  ('graff', 'Graff'),
  ('hermes', 'Hermès'),
  ('iwc', 'IWC Schaffhausen'),
  ('jaeger-lecoultre', 'Jaeger-LeCoultre'),
  ('louis-vuitton', 'Louis Vuitton'),
  ('omega', 'Omega'),
  ('panerai', 'Panerai'),
  ('patek-philippe', 'Patek Philippe'),
  ('rolex', 'Rolex'),
  ('tiffany-co', 'Tiffany & Co.'),
  ('vacheron-constantin', 'Vacheron Constantin'),
  ('van-cleef-arpels', 'Van Cleef & Arpels'),
  ('other', 'Other');