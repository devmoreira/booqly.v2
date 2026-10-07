-- Booqly: pagamentos passam a operar somente no ambiente de produção.
UPDATE public.configuracoes_plataforma
SET asaas_ambiente = 'production'
WHERE asaas_ambiente IS DISTINCT FROM 'production';

UPDATE public.profissionais
SET gateway_ambiente = 'production'
WHERE gateway_ambiente IS DISTINCT FROM 'production';
