-- Table catalogue des étapes : alimentée automatiquement à chaque road trip soumis
-- Sert de base d'inspiration pour les utilisateurs qui ne savent pas où aller

CREATE TABLE IF NOT EXISTS public.etapes_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lieu text NOT NULL,
  address text,
  type text,
  pays text,
  region text,
  usage_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.etapes_catalog ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour les suggestions
CREATE POLICY "etapes_catalog_public_read" ON public.etapes_catalog
  FOR SELECT USING (true);

-- Index pour les recherches par type et pays
CREATE INDEX IF NOT EXISTS etapes_catalog_type_idx ON public.etapes_catalog (type);
CREATE INDEX IF NOT EXISTS etapes_catalog_pays_idx ON public.etapes_catalog (pays);
CREATE INDEX IF NOT EXISTS etapes_catalog_usage_idx ON public.etapes_catalog (usage_count DESC);

-- Fonction upsert : incrémente usage_count si le lieu existe déjà, sinon insère
CREATE OR REPLACE FUNCTION public.upsert_etape_catalog(
  p_lieu text,
  p_address text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_pays text DEFAULT NULL,
  p_region text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.etapes_catalog (lieu, address, type, pays, region, usage_count)
  VALUES (p_lieu, p_address, p_type, p_pays, p_region, 1)
  ON CONFLICT DO NOTHING;

  UPDATE public.etapes_catalog
  SET usage_count = usage_count + 1,
      updated_at = now()
  WHERE lieu = p_lieu
    AND (type = p_type OR (type IS NULL AND p_type IS NULL));
END;
$$;
