-- Script de seed pour la base de données RPS Platform
-- A exécuter après init-db.sql

-- Utilisateur administrateur de depart
-- Mot de passe: password (hash bcrypt)
INSERT INTO users (name, email, password)
VALUES ('Administrateur RPS', 'admin@rps.local', '$2b$10$rH0z9X.vKJH7qN8qN8qN8OYqZ9X.vKJH7qN8qN8qN8OYqZ9X.vKJH');

-- Utilisatrices Laroche 360 (Canada)
-- Mot de passe: password (hash bcrypt identique)
INSERT INTO users (name, email, password)
VALUES 
  ('Isabelle Laroche', 'isabelle@laroche360.ca', '$2b$10$rH0z9X.vKJH7qN8qN8qN8OYqZ9X.vKJH7qN8qN8qN8OYqZ9X.vKJH'),
  ('Roxanne Laroche', 'roxanne@laroche360.ca', '$2b$10$rH0z9X.vKJH7qN8qN8qN8OYqZ9X.vKJH7qN8qN8qN8OYqZ9X.vKJH');

-- Entreprise de reference
INSERT INTO companies (name) VALUES ('Laroche Consulting');

-- Campagne active
INSERT INTO campaigns (company_id, name, start_date, end_date, status) 
VALUES (1, 'Campagne RPS Q1 2026', '2026-01-15', '2026-03-31', 'active');

-- Questions RPS
INSERT INTO questions (campaign_id, question_text, question_type, rps_dimension, order_index) VALUES
(1, 'Ressentez-vous une charge de travail excessive ?', 'scale', 'Charge de travail', 1),
(1, 'Avez-vous suffisamment de temps pour accomplir vos tâches ?', 'scale', 'Charge de travail', 2),
(1, 'Vous sentez-vous soutenu par votre management ?', 'scale', 'Soutien managérial', 3),
(1, 'L''environnement de travail est-il propice à votre bien-être ?', 'scale', 'Environnement', 4),
(1, 'Ressentez-vous du stress au quotidien ?', 'scale', 'Stress', 5),
(1, 'Avez-vous un bon équilibre vie pro/vie perso ?', 'scale', 'Équilibre vie pro/perso', 6),
(1, 'Vous sentez-vous reconnu dans votre travail ?', 'scale', 'Reconnaissance', 7),
(1, 'Avez-vous des relations positives avec vos collègues ?', 'scale', 'Relations sociales', 8);

-- Employés démo
INSERT INTO employees (company_id, first_name, last_name, email, phone, status, department) VALUES
(1, 'Jean', 'Dupont', 'jean.dupont@laroche.fr', NULL, 'active', 'RH'),
(1, 'Marie', 'Martin', 'marie.martin@laroche.fr', NULL, 'active', 'IT'),
(1, 'Pierre', 'Bernard', 'pierre.bernard@laroche.fr', NULL, 'active', 'Finance'),
(1, 'Sophie', 'Petit', 'sophie.petit@laroche.fr', NULL, 'active', 'Marketing'),
(1, 'Lucas', 'Robert', 'lucas.robert@laroche.fr', NULL, 'active', 'Production'),
(1, 'Emma', 'Richard', 'emma.richard@laroche.fr', NULL, 'active', 'RH'),
(1, 'Thomas', 'Durand', 'thomas.durand@laroche.fr', NULL, 'active', 'IT'),
(1, 'Camille', 'Dubois', 'camille.dubois@laroche.fr', NULL, 'active', 'Finance'),
(1, 'Nicolas', 'Moreau', 'nicolas.moreau@laroche.fr', NULL, 'active', 'Marketing'),
(1, 'Julie', 'Laurent', 'julie.laurent@laroche.fr', NULL, 'active', 'Production');

-- Participants à la campagne
INSERT INTO campaign_participants (campaign_id, employee_id, participation_token, status, invitation_sent_at, completed_at) VALUES
(1, 1, 'token-emp-1', 'completed', '2026-01-15 09:00:00', '2026-01-18 14:30:00'),
(1, 2, 'token-emp-2', 'completed', '2026-01-15 09:00:00', '2026-01-19 10:15:00'),
(1, 3, 'token-emp-3', 'completed', '2026-01-15 09:00:00', '2026-01-17 16:45:00'),
(1, 4, 'token-emp-4', 'completed', '2026-01-15 09:00:00', '2026-01-20 11:00:00'),
(1, 5, 'token-emp-5', 'pending', '2026-01-15 09:00:00', NULL),
(1, 6, 'token-emp-6', 'completed', '2026-01-15 09:00:00', '2026-01-21 09:30:00'),
(1, 7, 'token-emp-7', 'reminded', '2026-01-15 09:00:00', NULL),
(1, 8, 'token-emp-8', 'pending', '2026-01-15 09:00:00', NULL),
(1, 9, 'token-emp-9', 'completed', '2026-01-15 09:00:00', '2026-01-22 15:00:00'),
(1, 10, 'token-emp-10', 'completed', '2026-01-15 09:00:00', '2026-01-19 13:20:00');

-- Réponses (pour les employés ayant complété)
-- Jean Dupont (emp 1) - Stress élevé
INSERT INTO responses (employee_id, question_id, answer) VALUES
(1, 1, '5'), (1, 2, '2'), (1, 3, '3'), (1, 4, '3'), (1, 5, '5'), (1, 6, '2'), (1, 7, '3'), (1, 8, '4');

-- Marie Martin (emp 2) - Stress moyen
INSERT INTO responses (employee_id, question_id, answer) VALUES
(2, 1, '3'), (2, 2, '3'), (2, 3, '4'), (2, 4, '4'), (2, 5, '3'), (2, 6, '3'), (2, 7, '4'), (2, 8, '5');

-- Pierre Bernard (emp 3) - Stress faible
INSERT INTO responses (employee_id, question_id, answer) VALUES
(3, 1, '2'), (3, 2, '4'), (3, 3, '5'), (3, 4, '4'), (3, 5, '2'), (3, 6, '4'), (3, 7, '5'), (3, 8, '4');

-- Sophie Petit (emp 4) - Stress élevé
INSERT INTO responses (employee_id, question_id, answer) VALUES
(4, 1, '4'), (4, 2, '2'), (4, 3, '3'), (4, 4, '3'), (4, 5, '4'), (4, 6, '3'), (4, 7, '2'), (4, 8, '4');

-- Emma Richard (emp 6) - Stress moyen
INSERT INTO responses (employee_id, question_id, answer) VALUES
(6, 1, '3'), (6, 2, '3'), (6, 3, '4'), (6, 4, '4'), (6, 5, '3'), (6, 6, '3'), (6, 7, '3'), (6, 8, '4');

-- Nicolas Moreau (emp 9) - Stress élevé
INSERT INTO responses (employee_id, question_id, answer) VALUES
(9, 1, '5'), (9, 2, '2'), (9, 3, '2'), (9, 4, '3'), (9, 5, '5'), (9, 6, '2'), (9, 7, '3'), (9, 8, '3');

-- Julie Laurent (emp 10) - Stress faible
INSERT INTO responses (employee_id, question_id, answer) VALUES
(10, 1, '2'), (10, 2, '4'), (10, 3, '4'), (10, 4, '5'), (10, 5, '2'), (10, 6, '4'), (10, 7, '4'), (10, 8, '5');
