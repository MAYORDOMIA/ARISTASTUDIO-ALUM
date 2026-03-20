
-- SQL Schema for ARISTASTUDIO ALUM - Cotizador de Aberturas

-- Config Table
CREATE TABLE IF NOT EXISTS config (
  id INT PRIMARY KEY DEFAULT 1,
  aluminumPricePerKg FLOAT,
  laborPercentage FLOAT,
  discWidth FLOAT,
  taxRate FLOAT,
  blindPanelPricePerM2 FLOAT,
  meshPricePerM2 FLOAT,
  companyName TEXT,
  companyAddress TEXT,
  companyPhone TEXT,
  companyLogo TEXT,
  handrailExtraIncrement FLOAT,
  mamparaExtraIncrement FLOAT,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Aluminum Profiles
CREATE TABLE IF NOT EXISTS aluminum_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  detail TEXT,
  weightPerMeter FLOAT,
  barLength FLOAT,
  treatmentCost FLOAT,
  thickness FLOAT,
  isGlazingBead BOOLEAN,
  glazingBeadStyle TEXT,
  minGlassThickness FLOAT,
  maxGlassThickness FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Glasses
CREATE TABLE IF NOT EXISTS glasses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  detail TEXT,
  width FLOAT,
  height FLOAT,
  pricePerM2 FLOAT,
  thickness FLOAT,
  isMirror BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Blind Panels
CREATE TABLE IF NOT EXISTS blind_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  detail TEXT,
  price FLOAT,
  unit TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Accessories
CREATE TABLE IF NOT EXISTS accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  detail TEXT,
  unitPrice FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- DVH Inputs
CREATE TABLE IF NOT EXISTS dvh_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT,
  detail TEXT,
  cost FLOAT,
  thickness FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Treatments
CREATE TABLE IF NOT EXISTS treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  pricePerKg FLOAT,
  hexColor TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Product Recipes
CREATE TABLE IF NOT EXISTS product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  line TEXT,
  type TEXT,
  visualType TEXT,
  profiles JSONB,
  accessories JSONB,
  glassFormulaW TEXT,
  glassFormulaH TEXT,
  defaultTransomProfileId TEXT,
  transomFormula TEXT,
  transomThickness FLOAT,
  transomGlassDeduction FLOAT,
  defaultTransoms JSONB,
  glassDeductionW FLOAT,
  glassDeductionH FLOAT,
  image TEXT,
  isLocked BOOLEAN,
  defaultTapajuntas BOOLEAN,
  tapajuntasThickness FLOAT,
  defaultTapajuntasProfileId TEXT,
  defaultCouplingProfileId TEXT,
  defaultCouplingDeduction FLOAT,
  defaultMosquitero BOOLEAN,
  mosquiteroProfileId TEXT,
  mosquiteroFormulaW TEXT,
  mosquiteroFormulaH TEXT,
  leaves INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clientName TEXT,
  date TEXT,
  items JSONB,
  totalPrice FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Custom Visual Types
CREATE TABLE IF NOT EXISTS custom_visual_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Current Work Items (Obras)
CREATE TABLE IF NOT EXISTS current_work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itemCode TEXT,
  clientName TEXT,
  width FLOAT,
  height FLOAT,
  colorId TEXT,
  quantity INT,
  calculatedCost FLOAT,
  previewImage TEXT,
  breakdown JSONB,
  composition JSONB,
  extras JSONB,
  couplingProfileId TEXT,
  glazingBeadStyle TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS (Row Level Security)
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE aluminum_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE glasses ENABLE ROW LEVEL SECURITY;
ALTER TABLE blind_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE dvh_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_visual_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_work_items ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (for now, as per anon key usage)
-- In a real app, you'd use auth.uid() checks
CREATE POLICY "Public Read" ON config FOR SELECT USING (true);
CREATE POLICY "Public Write" ON config FOR ALL USING (true);

CREATE POLICY "Public Read" ON aluminum_profiles FOR SELECT USING (true);
CREATE POLICY "Public Write" ON aluminum_profiles FOR ALL USING (true);

CREATE POLICY "Public Read" ON glasses FOR SELECT USING (true);
CREATE POLICY "Public Write" ON glasses FOR ALL USING (true);

CREATE POLICY "Public Read" ON blind_panels FOR SELECT USING (true);
CREATE POLICY "Public Write" ON blind_panels FOR ALL USING (true);

CREATE POLICY "Public Read" ON accessories FOR SELECT USING (true);
CREATE POLICY "Public Write" ON accessories FOR ALL USING (true);

CREATE POLICY "Public Read" ON dvh_inputs FOR SELECT USING (true);
CREATE POLICY "Public Write" ON dvh_inputs FOR ALL USING (true);

CREATE POLICY "Public Read" ON treatments FOR SELECT USING (true);
CREATE POLICY "Public Write" ON treatments FOR ALL USING (true);

CREATE POLICY "Public Read" ON product_recipes FOR SELECT USING (true);
CREATE POLICY "Public Write" ON product_recipes FOR ALL USING (true);

CREATE POLICY "Public Read" ON quotes FOR SELECT USING (true);
CREATE POLICY "Public Write" ON quotes FOR ALL USING (true);

CREATE POLICY "Public Read" ON custom_visual_types FOR SELECT USING (true);
CREATE POLICY "Public Write" ON custom_visual_types FOR ALL USING (true);

CREATE POLICY "Public Read" ON current_work_items FOR SELECT USING (true);
CREATE POLICY "Public Write" ON current_work_items FOR ALL USING (true);
