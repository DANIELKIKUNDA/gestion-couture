CREATE TABLE IF NOT EXISTS public.notifications_systeme (
  id_notification TEXT PRIMARY KEY,
  portee TEXT NOT NULL,
  atelier_id TEXT NULL,
  titre TEXT NOT NULL,
  message TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'IN_APP',
  statut TEXT NOT NULL DEFAULT 'ENVOYEE',
  cree_par_user_id TEXT NOT NULL,
  cree_par_nom TEXT NOT NULL,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_envoi TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_systeme_date_creation
  ON public.notifications_systeme (date_creation DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_systeme_portee_date_creation
  ON public.notifications_systeme (portee, date_creation DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_systeme_atelier_date_creation
  ON public.notifications_systeme (atelier_id, date_creation DESC);
