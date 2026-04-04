CREATE TABLE IF NOT EXISTS public.notification_lectures (
  notification_id TEXT NOT NULL,
  atelier_id TEXT NOT NULL,
  lu_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lu_par_user_id TEXT NULL,
  PRIMARY KEY (notification_id, atelier_id),
  CONSTRAINT notification_lectures_notification_fk
    FOREIGN KEY (notification_id)
    REFERENCES public.notifications_systeme(id_notification)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_lectures_atelier_lu_at
  ON public.notification_lectures (atelier_id, lu_at DESC);
