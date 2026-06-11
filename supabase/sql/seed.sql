insert into public.partners (company_name, contact_name, email, website_url, description, status)
values
('Monarch Premium Garage','Admin','contact@example.com','https://example.com','Exemple de partenaire premium.', 'approved')
on conflict do nothing;
