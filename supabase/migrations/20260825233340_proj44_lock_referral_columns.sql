-- PROJ-44 Sicherheitsluecke, erster Anlauf -- wirkungslos.
--
-- Ein spaltenweiser Entzug hebt ein auf Tabellenebene vergebenes Recht nicht
-- auf. Der Angriff gelang danach unveraendert; die wirksame Reparatur steht
-- in 20260825233424_proj44_lock_referral_columns_properly.sql.
--
-- Diese Datei bleibt bestehen, weil die Datenbank sie als angewandt fuehrt --
-- sie zu loeschen wuerde einen Neuaufbau von der bestehenden Installation
-- abweichen lassen. Sie tut nichts Schaedliches.
revoke update (referral_code, referred_by, referral_rewarded_at)
  on public.profiles from authenticated, anon;
