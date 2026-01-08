--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9
-- Dumped by pg_dump version 16.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: adminpack; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS adminpack WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION adminpack; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION adminpack IS 'administrative functions for PostgreSQL';


--
-- Name: check_client_limits(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_client_limits(client_email character varying) RETURNS TABLE(limit_type character varying, current_value integer, limit_value integer, percentage numeric, status character varying)
    LANGUAGE plpgsql
    AS $$

BEGIN

    RETURN QUERY

    SELECT 

        'Domains'::VARCHAR,

        COUNT(DISTINCT ak.domain)::INTEGER,

        s.domains_allowed,

        ROUND((COUNT(DISTINCT ak.domain)::DECIMAL / NULLIF(s.domains_allowed, 0)) * 100, 2),

        CASE 

            WHEN COUNT(DISTINCT ak.domain) >= s.domains_allowed THEN 'LIMIT_REACHED'

            WHEN COUNT(DISTINCT ak.domain) >= s.domains_allowed * 0.8 THEN 'WARNING'

            ELSE 'OK'

        END::VARCHAR

    FROM clients c

    LEFT JOIN subscriptions s ON c.id = s.client_id AND s.is_active = true

    LEFT JOIN api_keys ak ON c.id = ak.client_id

    WHERE c.email = client_email

    GROUP BY s.domains_allowed

    

    UNION ALL

    

    SELECT 

        'Openings'::VARCHAR,

        s.current_openings_used::INTEGER,

        s.openings_limit,

        ROUND((s.current_openings_used::DECIMAL / NULLIF(s.openings_limit, 0)) * 100, 2),

        CASE 

            WHEN s.current_openings_used >= s.openings_limit THEN 'LIMIT_REACHED'

            WHEN s.current_openings_used >= s.openings_limit * 0.8 THEN 'WARNING'

            ELSE 'OK'

        END::VARCHAR

    FROM clients c

    LEFT JOIN subscriptions s ON c.id = s.client_id AND s.is_active = true

    WHERE c.email = client_email

    

    UNION ALL

    

    SELECT 

        'Custom Places'::VARCHAR,

        COUNT(ccp.id)::INTEGER,

        s.custom_places_limit,

        CASE 

            WHEN s.custom_places_limit = -1 THEN 0

            ELSE ROUND((COUNT(ccp.id)::DECIMAL / NULLIF(s.custom_places_limit, 0)) * 100, 2)

        END,

        CASE 

            WHEN s.custom_places_limit = -1 THEN 'UNLIMITED'

            WHEN COUNT(ccp.id) >= s.custom_places_limit THEN 'LIMIT_REACHED'

            WHEN COUNT(ccp.id) >= s.custom_places_limit * 0.8 THEN 'WARNING'

            ELSE 'OK'

        END::VARCHAR

    FROM clients c

    LEFT JOIN subscriptions s ON c.id = s.client_id AND s.is_active = true

    LEFT JOIN client_custom_places ccp ON c.id = ccp.client_id

    WHERE c.email = client_email

    GROUP BY s.custom_places_limit;

END;

$$;


ALTER FUNCTION public.check_client_limits(client_email character varying) OWNER TO postgres;

--
-- Name: check_domain_not_base(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_domain_not_base() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

    -- Verificar si el dominio que se intenta insertar es el dominio base del cliente

    IF EXISTS (

        SELECT 1 FROM clients 

        WHERE id = NEW.client_id 

        AND domain = NEW.domain

    ) THEN

        RAISE EXCEPTION 'No se puede agregar el dominio base como dominio extra';

    END IF;

    

    RETURN NEW;

END;

$$;


ALTER FUNCTION public.check_domain_not_base() OWNER TO postgres;

--
-- Name: FUNCTION check_domain_not_base(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.check_domain_not_base() IS 'Previene que el dominio base (clients.domain) se inserte en extra_domains';


--
-- Name: cleanup_old_usage_data(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_old_usage_data(days_to_keep integer DEFAULT 90) RETURNS TABLE(deleted_widget_records integer, deleted_api_records integer)
    LANGUAGE plpgsql
    AS $$

DECLARE

    deleted_widgets INTEGER;

    deleted_api INTEGER;

BEGIN

    DELETE FROM widget_usage 

    WHERE created_at < CURRENT_DATE - days_to_keep * INTERVAL '1 day';

    GET DIAGNOSTICS deleted_widgets = ROW_COUNT;

    

    DELETE FROM api_usage 

    WHERE created_at < CURRENT_DATE - days_to_keep * INTERVAL '1 day';

    GET DIAGNOSTICS deleted_api = ROW_COUNT;

    

    RETURN QUERY SELECT deleted_widgets, deleted_api;

END;

$$;


ALTER FUNCTION public.cleanup_old_usage_data(days_to_keep integer) OWNER TO postgres;

--
-- Name: cleanup_old_widget_usage(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_old_widget_usage() RETURNS void
    LANGUAGE plpgsql
    AS $$

BEGIN

    DELETE FROM widget_usage

    WHERE created_at < CURRENT_DATE - 365; -- Mantener solo 1 año

    

    RAISE NOTICE 'Cleanup completado';

END;

$$;


ALTER FUNCTION public.cleanup_old_widget_usage() OWNER TO postgres;

--
-- Name: get_dashboard_stats(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_dashboard_stats(p_client_id integer, p_period_days integer DEFAULT 30) RETURNS TABLE(total_openings bigint, active_domains bigint, countries_viewed bigint, avg_response_time integer, views_today bigint, views_week bigint, views_month bigint)
    LANGUAGE plpgsql
    AS $$

BEGIN

    RETURN QUERY

    SELECT 

        COUNT(*) as total_openings,

        COUNT(DISTINCT wu.domain) as active_domains,

        COUNT(DISTINCT wu.country_name) as countries_viewed,

        AVG(wu.response_time)::int as avg_response_time,

        COUNT(CASE WHEN wu.created_at >= CURRENT_DATE THEN 1 END) as views_today,

        COUNT(CASE WHEN wu.created_at >= CURRENT_DATE - 7 THEN 1 END) as views_week,

        COUNT(CASE WHEN wu.created_at >= CURRENT_DATE - 30 THEN 1 END) as views_month

    FROM widget_usage wu

    WHERE wu.client_id = p_client_id

      AND wu.created_at >= CURRENT_DATE - p_period_days;

END;

$$;


ALTER FUNCTION public.get_dashboard_stats(p_client_id integer, p_period_days integer) OWNER TO postgres;

--
-- Name: FUNCTION get_dashboard_stats(p_client_id integer, p_period_days integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_dashboard_stats(p_client_id integer, p_period_days integer) IS 'Retorna estadísticas principales para el dashboard';


--
-- Name: get_top_domains(integer, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_top_domains(p_client_id integer, p_period_days integer DEFAULT 30, p_limit integer DEFAULT 10) RETURNS TABLE(domain character varying, total_views bigint, countries bigint, places bigint, avg_response_time integer, last_activity timestamp without time zone)
    LANGUAGE plpgsql
    AS $$

BEGIN

    RETURN QUERY

    SELECT 

        wu.domain,

        COUNT(*) as total_views,

        COUNT(DISTINCT wu.country_name) as countries,

        COUNT(DISTINCT wu.place_name) as places,

        AVG(wu.response_time)::int as avg_response_time,

        MAX(wu.created_at) as last_activity

    FROM widget_usage wu

    WHERE wu.client_id = p_client_id

      AND wu.created_at >= CURRENT_DATE - p_period_days

      AND wu.domain IS NOT NULL

    GROUP BY wu.domain

    ORDER BY total_views DESC

    LIMIT p_limit;

END;

$$;


ALTER FUNCTION public.get_top_domains(p_client_id integer, p_period_days integer, p_limit integer) OWNER TO postgres;

--
-- Name: FUNCTION get_top_domains(p_client_id integer, p_period_days integer, p_limit integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_top_domains(p_client_id integer, p_period_days integer, p_limit integer) IS 'Retorna los dominios con más actividad';


--
-- Name: get_total_domains_allowed(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_total_domains_allowed(p_client_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$

DECLARE

    v_base_domains INTEGER;

    v_extra_domains INTEGER;

    v_total_domains INTEGER;

BEGIN

    -- Dominios base del plan (siempre 1 por defecto)

    SELECT COALESCE(domains_allowed, 1)

    INTO v_base_domains

    FROM subscriptions

    WHERE client_id = p_client_id AND is_active = true;



    -- Contar solo dominios EXTRA activos (los pagados)

    -- 🔥 Ya no filtramos por is_base_domain porque no existe

    SELECT COUNT(*)

    INTO v_extra_domains

    FROM extra_domains

    WHERE client_id = p_client_id

      AND status = 'active';



    v_total_domains := COALESCE(v_base_domains, 1) + COALESCE(v_extra_domains, 0);

    

    RETURN v_total_domains;

END;

$$;


ALTER FUNCTION public.get_total_domains_allowed(p_client_id integer) OWNER TO postgres;

--
-- Name: FUNCTION get_total_domains_allowed(p_client_id integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_total_domains_allowed(p_client_id integer) IS 'Calcula dominios permitidos: base (del plan) + extras (pagados). NO incluye clients.domain';


--
-- Name: log_subscription_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_subscription_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

    IF (OLD.plan_type IS DISTINCT FROM NEW.plan_type OR 

        OLD.domains_allowed IS DISTINCT FROM NEW.domains_allowed OR

        OLD.openings_limit IS DISTINCT FROM NEW.openings_limit OR

        OLD.custom_places_limit IS DISTINCT FROM NEW.custom_places_limit) THEN

        

        INSERT INTO subscription_history (

            client_id, 

            old_plan_type, new_plan_type,

            old_domains_allowed, new_domains_allowed,

            old_openings_limit, new_openings_limit,

            old_custom_places_limit, new_custom_places_limit,

            change_reason

        )

        VALUES (

            NEW.client_id,

            OLD.plan_type, NEW.plan_type,

            OLD.domains_allowed, NEW.domains_allowed,

            OLD.openings_limit, NEW.openings_limit,

            OLD.custom_places_limit, NEW.custom_places_limit,

            'Plan updated'

        );

    END IF;

    

    RETURN NEW;

END;

$$;


ALTER FUNCTION public.log_subscription_change() OWNER TO postgres;

--
-- Name: reset_monthly_openings(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reset_monthly_openings() RETURNS void
    LANGUAGE plpgsql
    AS $$

BEGIN

    UPDATE subscriptions

    SET 

        current_openings_used = 0,

        openings_reset_date = NOW()

    WHERE 

        is_active = true 

        AND openings_reset_date < NOW() - INTERVAL '1 month';

END;

$$;


ALTER FUNCTION public.reset_monthly_openings() OWNER TO postgres;

--
-- Name: update_contact_messages_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_contact_messages_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

    NEW.updated_at = CURRENT_TIMESTAMP;

    RETURN NEW;

END;

$$;


ALTER FUNCTION public.update_contact_messages_updated_at() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

    NEW.updated_at = NOW();

    RETURN NEW;

END;

$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_deletion_feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account_deletion_feedback (
    id integer NOT NULL,
    client_id integer NOT NULL,
    user_email character varying(255) NOT NULL,
    user_name character varying(255),
    user_plan character varying(50),
    domain_used character varying(255),
    leave_reason character varying(100) NOT NULL,
    rating integer NOT NULL,
    improvements jsonb DEFAULT '[]'::jsonb,
    specific_feedback text,
    additional_comments text,
    deletion_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    account_created_date timestamp without time zone,
    widget_opens integer DEFAULT 0,
    custom_places integer DEFAULT 0,
    api_keys_generated integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT account_deletion_feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.account_deletion_feedback OWNER TO postgres;

--
-- Name: TABLE account_deletion_feedback; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.account_deletion_feedback IS 'Almacena el feedback de usuarios que eliminan sus cuentas';


--
-- Name: COLUMN account_deletion_feedback.leave_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.account_deletion_feedback.leave_reason IS 'Razón principal por la que el usuario elimina su cuenta';


--
-- Name: COLUMN account_deletion_feedback.rating; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.account_deletion_feedback.rating IS 'Calificación de 1 a 5 estrellas de la experiencia';


--
-- Name: COLUMN account_deletion_feedback.improvements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.account_deletion_feedback.improvements IS 'Array JSON con áreas de mejora seleccionadas';


--
-- Name: account_deletion_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.account_deletion_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.account_deletion_feedback_id_seq OWNER TO postgres;

--
-- Name: account_deletion_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.account_deletion_feedback_id_seq OWNED BY public.account_deletion_feedback.id;


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_keys (
    id integer NOT NULL,
    client_id integer,
    api_key text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    domain character varying(255),
    description text,
    allowed_origins text DEFAULT '*'::text,
    usage_count integer DEFAULT 0,
    last_used_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.api_keys OWNER TO postgres;

--
-- Name: api_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.api_keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.api_keys_id_seq OWNER TO postgres;

--
-- Name: api_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.api_keys_id_seq OWNED BY public.api_keys.id;


--
-- Name: api_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_usage (
    id integer NOT NULL,
    client_id integer NOT NULL,
    api_key_id integer,
    endpoint character varying(255) NOT NULL,
    method character varying(10) NOT NULL,
    status_code integer,
    response_time integer,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    date date DEFAULT CURRENT_DATE
);


ALTER TABLE public.api_usage OWNER TO postgres;

--
-- Name: api_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.api_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.api_usage_id_seq OWNER TO postgres;

--
-- Name: api_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.api_usage_id_seq OWNED BY public.api_usage.id;


--
-- Name: client_custom_places; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_custom_places (
    id integer NOT NULL,
    client_id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    image_url text NOT NULL,
    link_url text NOT NULL,
    price numeric(10,2),
    category character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    show_on_map boolean DEFAULT false,
    latitude numeric(10,8),
    longitude numeric(11,8),
    country_id integer,
    show_all_countries boolean DEFAULT false,
    api_key_id integer NOT NULL,
    cloudinary_public_id character varying(255),
    currency character varying(3) DEFAULT 'EUR'::character varying,
    CONSTRAINT check_map_coordinates CHECK (((show_on_map = false) OR ((show_on_map = true) AND (latitude IS NOT NULL) AND (longitude IS NOT NULL)))),
    CONSTRAINT check_valid_coordinates CHECK ((((latitude IS NULL) AND (longitude IS NULL)) OR (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)) AND ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))))),
    CONSTRAINT description_length CHECK ((length(description) <= 300))
);


ALTER TABLE public.client_custom_places OWNER TO postgres;

--
-- Name: TABLE client_custom_places; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.client_custom_places IS 'Lugares personalizados vinculados a API keys (dominios) específicos. Cada dominio puede tener sus propios lugares.';


--
-- Name: COLUMN client_custom_places.client_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_custom_places.client_id IS 'Cliente propietario (mantenido para compatibilidad y consultas agregadas)';


--
-- Name: COLUMN client_custom_places.show_on_map; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_custom_places.show_on_map IS 'Indica si el lugar debe mostrarse en el mapa del widget';


--
-- Name: COLUMN client_custom_places.latitude; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_custom_places.latitude IS 'Latitud del lugar (rango: -90 a 90)';


--
-- Name: COLUMN client_custom_places.longitude; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_custom_places.longitude IS 'Longitud del lugar (rango: -180 a 180)';


--
-- Name: COLUMN client_custom_places.country_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_custom_places.country_id IS 'ID del país donde se muestra el lugar. NULL si show_all_countries es TRUE';


--
-- Name: COLUMN client_custom_places.show_all_countries; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_custom_places.show_all_countries IS 'Si es TRUE, el lugar se muestra en todos los países';


--
-- Name: COLUMN client_custom_places.api_key_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_custom_places.api_key_id IS 'API key (dominio) al que pertenece este lugar personalizado';


--
-- Name: COLUMN client_custom_places.cloudinary_public_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.client_custom_places.cloudinary_public_id IS 'Public ID de Cloudinary para gestionar la imagen. Formato: customPlaces/client-{id}/domain-{id}/place-{id}-{timestamp}';


--
-- Name: client_custom_places_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.client_custom_places_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.client_custom_places_id_seq OWNER TO postgres;

--
-- Name: client_custom_places_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.client_custom_places_id_seq OWNED BY public.client_custom_places.id;


--
-- Name: widget_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.widget_usage (
    id integer NOT NULL,
    client_id integer NOT NULL,
    api_key_id integer,
    widget_type character varying(50) NOT NULL,
    event_type character varying(50) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    referer text,
    country_name character varying(100),
    place_name character varying(255),
    place_data jsonb,
    custom_name character varying(255),
    response_time integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    date date DEFAULT CURRENT_DATE,
    domain character varying(255),
    is_opening boolean DEFAULT false
);


ALTER TABLE public.widget_usage OWNER TO postgres;

--
-- Name: COLUMN widget_usage.is_opening; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.widget_usage.is_opening IS 'Indica si el evento es una apertura real del widget (cuenta para límites mensuales). 

Eventos de navegación interna (navigate_country, navigate_place) tienen is_opening = false';


--
-- Name: client_domains_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.client_domains_summary AS
 SELECT client_id,
    domain,
    count(*) AS total_views,
    count(DISTINCT widget_type) AS widget_types,
    count(DISTINCT country_name) AS countries,
    count(DISTINCT place_name) AS places,
    (avg(response_time))::integer AS avg_response_time,
    max(created_at) AS last_used,
    min(created_at) AS first_used,
    count(
        CASE
            WHEN (created_at >= CURRENT_DATE) THEN 1
            ELSE NULL::integer
        END) AS views_today,
    count(
        CASE
            WHEN (created_at >= (CURRENT_DATE - 7)) THEN 1
            ELSE NULL::integer
        END) AS views_week,
    count(
        CASE
            WHEN (created_at >= (CURRENT_DATE - 30)) THEN 1
            ELSE NULL::integer
        END) AS views_month,
        CASE
            WHEN (max(created_at) >= (CURRENT_DATE - 7)) THEN true
            ELSE false
        END AS is_active
   FROM public.widget_usage wu
  WHERE (domain IS NOT NULL)
  GROUP BY client_id, domain;


ALTER VIEW public.client_domains_summary OWNER TO postgres;

--
-- Name: VIEW client_domains_summary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.client_domains_summary IS 'Resumen de actividad por dominio para cada cliente';


--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    phone text,
    addresses text,
    is_subscribed boolean DEFAULT false,
    domain character varying(255),
    stripe_customer_id character varying(255)
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id integer NOT NULL,
    client_id integer,
    plan_type character varying(50) NOT NULL,
    is_active boolean DEFAULT true,
    start_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    end_date timestamp without time zone,
    payment_status character varying(50) DEFAULT 'pending'::character varying,
    domains_allowed integer DEFAULT 1,
    openings_limit integer DEFAULT 3000,
    custom_places_limit integer DEFAULT 0,
    current_openings_used integer DEFAULT 0,
    extra_domains_purchased integer DEFAULT 0,
    openings_reset_date timestamp without time zone DEFAULT now(),
    status character varying(50) DEFAULT 'active'::character varying,
    current_period_end timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    stripe_subscription_id character varying(255),
    stripe_customer_id character varying(255),
    stripe_price_id character varying(255),
    next_billing_date timestamp without time zone,
    auto_renew boolean DEFAULT true,
    payment_method_id character varying(255),
    cancel_at_period_end boolean DEFAULT false,
    cancellation_reason text,
    cancelled_at timestamp without time zone
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- Name: COLUMN subscriptions.domains_allowed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscriptions.domains_allowed IS 'Número de dominios permitidos (base). Starter: 1, Business: 1, Enterprise: 1';


--
-- Name: COLUMN subscriptions.openings_limit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscriptions.openings_limit IS 'Límite mensual de aperturas del widget. Starter: 3000, Business: 20000, Enterprise: 150000';


--
-- Name: COLUMN subscriptions.custom_places_limit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscriptions.custom_places_limit IS 'Límite de lugares personalizados. Starter: 0, Business: 100, Enterprise: -1 (ilimitado)';


--
-- Name: COLUMN subscriptions.current_openings_used; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscriptions.current_openings_used IS 'Contador de aperturas usadas en el periodo actual';


--
-- Name: COLUMN subscriptions.extra_domains_purchased; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.subscriptions.extra_domains_purchased IS 'Dominios adicionales comprados (€10 Business, €15 Enterprise)';


--
-- Name: client_usage_stats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.client_usage_stats AS
 SELECT c.id AS client_id,
    c.email,
    c.name,
    s.plan_type,
    s.domains_allowed,
    s.openings_limit,
    s.custom_places_limit,
    s.current_openings_used,
    s.extra_domains_purchased,
    count(DISTINCT ak.domain) AS domains_used,
    count(DISTINCT
        CASE
            WHEN (ak.is_active = true) THEN ak.id
            ELSE NULL::integer
        END) AS active_keys,
    count(DISTINCT ccp.id) AS custom_places_count,
    round((((s.current_openings_used)::numeric / (NULLIF(s.openings_limit, 0))::numeric) * (100)::numeric), 2) AS openings_usage_percent
   FROM (((public.clients c
     LEFT JOIN public.subscriptions s ON (((c.id = s.client_id) AND (s.is_active = true))))
     LEFT JOIN public.api_keys ak ON ((c.id = ak.client_id)))
     LEFT JOIN public.client_custom_places ccp ON ((c.id = ccp.client_id)))
  GROUP BY c.id, c.email, c.name, s.plan_type, s.domains_allowed, s.openings_limit, s.custom_places_limit, s.current_openings_used, s.extra_domains_purchased;


ALTER VIEW public.client_usage_stats OWNER TO postgres;

--
-- Name: client_usage_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.client_usage_summary AS
 SELECT c.id AS client_id,
    c.email,
    c.name,
    count(DISTINCT wu.id) AS total_widget_views,
    count(DISTINCT au.id) AS total_api_calls,
    count(DISTINCT wu.date) AS active_days,
    max(wu.created_at) AS last_widget_usage,
    max(au.created_at) AS last_api_usage
   FROM ((public.clients c
     LEFT JOIN public.widget_usage wu ON ((c.id = wu.client_id)))
     LEFT JOIN public.api_usage au ON ((c.id = au.client_id)))
  GROUP BY c.id, c.email, c.name;


ALTER VIEW public.client_usage_summary OWNER TO postgres;

--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clients_id_seq OWNER TO postgres;

--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_messages (
    id integer NOT NULL,
    client_id integer,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    subject character varying(255),
    priority character varying(20) DEFAULT 'low'::character varying,
    message text NOT NULL,
    source character varying(50) DEFAULT 'dashboard'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    admin_notes text,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.contact_messages OWNER TO postgres;

--
-- Name: TABLE contact_messages; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.contact_messages IS 'Mensajes de contacto de clientes autenticados';


--
-- Name: COLUMN contact_messages.priority; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contact_messages.priority IS 'Prioridad del mensaje: low, medium, high';


--
-- Name: COLUMN contact_messages.source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contact_messages.source IS 'Origen del mensaje: dashboard, landing, api';


--
-- Name: COLUMN contact_messages.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contact_messages.status IS 'Estado: pending, in_progress, resolved, closed';


--
-- Name: contact_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contact_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contact_messages_id_seq OWNER TO postgres;

--
-- Name: contact_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contact_messages_id_seq OWNED BY public.contact_messages.id;


--
-- Name: countries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.countries (
    id integer NOT NULL,
    name text,
    data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone
);


ALTER TABLE public.countries OWNER TO postgres;

--
-- Name: countries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.countries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.countries_id_seq OWNER TO postgres;

--
-- Name: countries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.countries_id_seq OWNED BY public.countries.id;


--
-- Name: export_downloads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.export_downloads (
    id integer NOT NULL,
    client_id integer NOT NULL,
    export_type character varying(50) NOT NULL,
    domain character varying(255),
    period integer NOT NULL,
    cached boolean DEFAULT false,
    downloaded_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.export_downloads OWNER TO postgres;

--
-- Name: export_downloads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.export_downloads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.export_downloads_id_seq OWNER TO postgres;

--
-- Name: export_downloads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.export_downloads_id_seq OWNED BY public.export_downloads.id;


--
-- Name: extra_domains; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.extra_domains (
    id integer NOT NULL,
    client_id integer NOT NULL,
    domain character varying(255) NOT NULL,
    stripe_subscription_id character varying(255),
    status character varying(50) DEFAULT 'active'::character varying,
    monthly_price integer NOT NULL,
    next_billing_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT valid_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'cancelled'::character varying, 'expired'::character varying])::text[])))
);


ALTER TABLE public.extra_domains OWNER TO postgres;

--
-- Name: TABLE extra_domains; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.extra_domains IS 'Gestión de dominios adicionales comprados por clientes Business y Enterprise';


--
-- Name: COLUMN extra_domains.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.extra_domains.status IS 'Estado del dominio adicional: active, cancelled, expired';


--
-- Name: COLUMN extra_domains.monthly_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.extra_domains.monthly_price IS 'Precio mensual en centavos (1000 = 10€, 1500 = 15€)';


--
-- Name: extra_domains_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.extra_domains_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.extra_domains_id_seq OWNER TO postgres;

--
-- Name: extra_domains_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.extra_domains_id_seq OWNED BY public.extra_domains.id;


--
-- Name: gdpr_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gdpr_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer NOT NULL,
    email character varying(255) NOT NULL,
    reason character varying(100),
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    error_message text,
    ip_address inet,
    user_agent text,
    CONSTRAINT gdpr_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'error'::character varying])::text[])))
);


ALTER TABLE public.gdpr_requests OWNER TO postgres;

--
-- Name: natural_places; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.natural_places (
    id integer NOT NULL,
    name text NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.natural_places OWNER TO postgres;

--
-- Name: natural_places_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.natural_places_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.natural_places_id_seq OWNER TO postgres;

--
-- Name: natural_places_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.natural_places_id_seq OWNED BY public.natural_places.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    client_id integer NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO postgres;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: payment_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_logs (
    id integer NOT NULL,
    user_email character varying(255) NOT NULL,
    stripe_session_id character varying(255) NOT NULL,
    plan_id character varying(100),
    amount integer,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    email_sent boolean DEFAULT false,
    email_sent_at timestamp without time zone,
    email_error text,
    subscription_id character varying(255),
    payment_type character varying(50) DEFAULT 'one-time'::character varying,
    invoice_id character varying(255),
    payment_intent_id character varying(255),
    failure_reason text,
    retry_count integer DEFAULT 0,
    download_count integer DEFAULT 0,
    last_download_at timestamp without time zone
);


ALTER TABLE public.payment_logs OWNER TO postgres;

--
-- Name: COLUMN payment_logs.email_sent; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_logs.email_sent IS 'Indica si el email de confirmación fue enviado';


--
-- Name: COLUMN payment_logs.email_sent_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_logs.email_sent_at IS 'Fecha y hora del envío del email';


--
-- Name: COLUMN payment_logs.email_error; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_logs.email_error IS 'Mensaje de error si el email falló';


--
-- Name: payment_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_logs_id_seq OWNER TO postgres;

--
-- Name: payment_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_logs_id_seq OWNED BY public.payment_logs.id;


--
-- Name: performance_by_hour; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.performance_by_hour AS
 SELECT client_id,
    domain,
    (EXTRACT(hour FROM created_at))::integer AS hour,
    count(*) AS requests,
    (avg(response_time))::integer AS avg_response_time,
    min(response_time) AS min_response_time,
    max(response_time) AS max_response_time,
    (percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((response_time)::double precision)))::integer AS median_response_time,
    (percentile_cont((0.95)::double precision) WITHIN GROUP (ORDER BY ((response_time)::double precision)))::integer AS p95_response_time
   FROM public.widget_usage wu
  WHERE (response_time IS NOT NULL)
  GROUP BY client_id, domain, (EXTRACT(hour FROM created_at));


ALTER VIEW public.performance_by_hour OWNER TO postgres;

--
-- Name: VIEW performance_by_hour; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.performance_by_hour IS 'Métricas de rendimiento agrupadas por hora del día';


--
-- Name: renewal_reminders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.renewal_reminders (
    id integer NOT NULL,
    subscription_id character varying(255) NOT NULL,
    sent_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.renewal_reminders OWNER TO postgres;

--
-- Name: renewal_reminders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.renewal_reminders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.renewal_reminders_id_seq OWNER TO postgres;

--
-- Name: renewal_reminders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.renewal_reminders_id_seq OWNED BY public.renewal_reminders.id;


--
-- Name: subscription_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_history (
    id integer NOT NULL,
    client_id integer,
    old_plan_type character varying(50),
    new_plan_type character varying(50),
    old_domains_allowed integer,
    new_domains_allowed integer,
    old_openings_limit integer,
    new_openings_limit integer,
    old_custom_places_limit integer,
    new_custom_places_limit integer,
    change_reason character varying(255),
    changed_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.subscription_history OWNER TO postgres;

--
-- Name: subscription_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscription_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscription_history_id_seq OWNER TO postgres;

--
-- Name: subscription_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscription_history_id_seq OWNED BY public.subscription_history.id;


--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscriptions_id_seq OWNER TO postgres;

--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;


--
-- Name: top_countries_by_domain; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.top_countries_by_domain AS
 SELECT client_id,
    domain,
    country_name,
    count(*) AS views,
    count(DISTINCT place_name) AS unique_places,
    max(created_at) AS last_viewed,
    row_number() OVER (PARTITION BY client_id, domain ORDER BY (count(*)) DESC) AS rank_in_domain
   FROM public.widget_usage wu
  WHERE ((domain IS NOT NULL) AND (country_name IS NOT NULL))
  GROUP BY client_id, domain, country_name;


ALTER VIEW public.top_countries_by_domain OWNER TO postgres;

--
-- Name: VIEW top_countries_by_domain; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.top_countries_by_domain IS 'Ranking de países más vistos por dominio';


--
-- Name: v_client_domains_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_client_domains_summary AS
 SELECT c.id AS client_id,
    c.email,
    c.domain AS base_domain,
    s.plan_type,
    s.domains_allowed AS plan_base_domains,
    COALESCE(extra_count.total, (0)::bigint) AS extra_domains_purchased,
    (COALESCE(s.domains_allowed, 1) + COALESCE(extra_count.total, (0)::bigint)) AS total_domains_allowed,
    COALESCE(used_count.total, (0)::bigint) AS domains_with_api_keys,
    ((COALESCE(s.domains_allowed, 1) + COALESCE(extra_count.total, (0)::bigint)) - COALESCE(used_count.total, (0)::bigint)) AS domains_available
   FROM (((public.clients c
     LEFT JOIN public.subscriptions s ON (((c.id = s.client_id) AND (s.is_active = true))))
     LEFT JOIN ( SELECT extra_domains.client_id,
            count(*) AS total
           FROM public.extra_domains
          WHERE ((extra_domains.status)::text = 'active'::text)
          GROUP BY extra_domains.client_id) extra_count ON ((c.id = extra_count.client_id)))
     LEFT JOIN ( SELECT api_keys.client_id,
            count(DISTINCT api_keys.domain) AS total
           FROM public.api_keys
          WHERE (api_keys.is_active = true)
          GROUP BY api_keys.client_id) used_count ON ((c.id = used_count.client_id)));


ALTER VIEW public.v_client_domains_summary OWNER TO postgres;

--
-- Name: VIEW v_client_domains_summary; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.v_client_domains_summary IS 'Vista limpia: base_domain desde clients, extras desde extra_domains (sin filtro is_base_domain)';


--
-- Name: v_export_stats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_export_stats AS
 SELECT client_id,
    export_type,
    count(*) AS total_downloads,
    count(
        CASE
            WHEN cached THEN 1
            ELSE NULL::integer
        END) AS cached_downloads,
    max(downloaded_at) AS last_download
   FROM public.export_downloads
  WHERE (downloaded_at >= (now() - '30 days'::interval))
  GROUP BY client_id, export_type;


ALTER VIEW public.v_export_stats OWNER TO postgres;

--
-- Name: widget_stats_by_domain; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.widget_stats_by_domain AS
 SELECT client_id,
    domain,
    widget_type,
    count(*) AS total_views,
    count(
        CASE
            WHEN ((event_type)::text = 'load'::text) THEN 1
            ELSE NULL::integer
        END) AS loads,
    count(
        CASE
            WHEN ((event_type)::text = 'click_country'::text) THEN 1
            ELSE NULL::integer
        END) AS country_clicks,
    count(
        CASE
            WHEN ((event_type)::text = 'click_place'::text) THEN 1
            ELSE NULL::integer
        END) AS place_clicks,
    count(DISTINCT country_name) AS unique_countries,
    count(DISTINCT place_name) AS unique_places,
    (avg(response_time))::integer AS avg_response_time,
    min(response_time) AS min_response_time,
    max(response_time) AS max_response_time,
    max(created_at) AS last_activity,
    date(created_at) AS activity_date
   FROM public.widget_usage wu
  WHERE (domain IS NOT NULL)
  GROUP BY client_id, domain, widget_type, (date(created_at));


ALTER VIEW public.widget_stats_by_domain OWNER TO postgres;

--
-- Name: VIEW widget_stats_by_domain; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.widget_stats_by_domain IS 'Estadísticas de widgets agrupadas por cliente, dominio, tipo y día';


--
-- Name: widget_stats_global; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.widget_stats_global AS
 SELECT client_id,
    count(*) AS total_openings,
    count(DISTINCT domain) AS active_domains,
    count(DISTINCT widget_type) AS widget_types_used,
    count(DISTINCT country_name) AS countries_viewed,
    count(DISTINCT place_name) AS places_viewed,
    count(
        CASE
            WHEN ((event_type)::text = 'load'::text) THEN 1
            ELSE NULL::integer
        END) AS total_loads,
    count(
        CASE
            WHEN ((event_type)::text = 'click_country'::text) THEN 1
            ELSE NULL::integer
        END) AS total_country_clicks,
    count(
        CASE
            WHEN ((event_type)::text = 'click_place'::text) THEN 1
            ELSE NULL::integer
        END) AS total_place_clicks,
    (avg(response_time))::integer AS avg_response_time,
    min(response_time) AS min_response_time,
    max(response_time) AS max_response_time,
    count(DISTINCT date(created_at)) AS active_days,
    min(created_at) AS first_activity,
    max(created_at) AS last_activity,
    date_trunc('month'::text, created_at) AS activity_month
   FROM public.widget_usage wu
  GROUP BY client_id, (date_trunc('month'::text, created_at));


ALTER VIEW public.widget_stats_global OWNER TO postgres;

--
-- Name: VIEW widget_stats_global; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.widget_stats_global IS 'Estadísticas globales del cliente agrupadas por mes';


--
-- Name: widget_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.widget_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.widget_usage_id_seq OWNER TO postgres;

--
-- Name: widget_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.widget_usage_id_seq OWNED BY public.widget_usage.id;


--
-- Name: account_deletion_feedback id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_deletion_feedback ALTER COLUMN id SET DEFAULT nextval('public.account_deletion_feedback_id_seq'::regclass);


--
-- Name: api_keys id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys ALTER COLUMN id SET DEFAULT nextval('public.api_keys_id_seq'::regclass);


--
-- Name: api_usage id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_usage ALTER COLUMN id SET DEFAULT nextval('public.api_usage_id_seq'::regclass);


--
-- Name: client_custom_places id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_custom_places ALTER COLUMN id SET DEFAULT nextval('public.client_custom_places_id_seq'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: contact_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_messages ALTER COLUMN id SET DEFAULT nextval('public.contact_messages_id_seq'::regclass);


--
-- Name: countries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.countries ALTER COLUMN id SET DEFAULT nextval('public.countries_id_seq'::regclass);


--
-- Name: export_downloads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.export_downloads ALTER COLUMN id SET DEFAULT nextval('public.export_downloads_id_seq'::regclass);


--
-- Name: extra_domains id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extra_domains ALTER COLUMN id SET DEFAULT nextval('public.extra_domains_id_seq'::regclass);


--
-- Name: natural_places id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.natural_places ALTER COLUMN id SET DEFAULT nextval('public.natural_places_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: payment_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_logs ALTER COLUMN id SET DEFAULT nextval('public.payment_logs_id_seq'::regclass);


--
-- Name: renewal_reminders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.renewal_reminders ALTER COLUMN id SET DEFAULT nextval('public.renewal_reminders_id_seq'::regclass);


--
-- Name: subscription_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_history ALTER COLUMN id SET DEFAULT nextval('public.subscription_history_id_seq'::regclass);


--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);


--
-- Name: widget_usage id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.widget_usage ALTER COLUMN id SET DEFAULT nextval('public.widget_usage_id_seq'::regclass);


--
-- Name: account_deletion_feedback account_deletion_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_deletion_feedback
    ADD CONSTRAINT account_deletion_feedback_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_api_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_api_key_key UNIQUE (api_key);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: api_usage api_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_usage
    ADD CONSTRAINT api_usage_pkey PRIMARY KEY (id);


--
-- Name: client_custom_places client_custom_places_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_custom_places
    ADD CONSTRAINT client_custom_places_pkey PRIMARY KEY (id);


--
-- Name: clients clients_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_email_key UNIQUE (email);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: clients clients_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);


--
-- Name: countries countries_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_name_key UNIQUE (name);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: export_downloads export_downloads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.export_downloads
    ADD CONSTRAINT export_downloads_pkey PRIMARY KEY (id);


--
-- Name: extra_domains extra_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extra_domains
    ADD CONSTRAINT extra_domains_pkey PRIMARY KEY (id);


--
-- Name: extra_domains extra_domains_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extra_domains
    ADD CONSTRAINT extra_domains_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: gdpr_requests gdpr_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gdpr_requests
    ADD CONSTRAINT gdpr_requests_pkey PRIMARY KEY (id);


--
-- Name: natural_places natural_places_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.natural_places
    ADD CONSTRAINT natural_places_name_key UNIQUE (name);


--
-- Name: natural_places natural_places_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.natural_places
    ADD CONSTRAINT natural_places_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: payment_logs payment_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_logs
    ADD CONSTRAINT payment_logs_pkey PRIMARY KEY (id);


--
-- Name: renewal_reminders renewal_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.renewal_reminders
    ADD CONSTRAINT renewal_reminders_pkey PRIMARY KEY (id);


--
-- Name: renewal_reminders renewal_reminders_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.renewal_reminders
    ADD CONSTRAINT renewal_reminders_subscription_id_key UNIQUE (subscription_id);


--
-- Name: subscription_history subscription_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_history
    ADD CONSTRAINT subscription_history_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: extra_domains unique_domain_per_client; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extra_domains
    ADD CONSTRAINT unique_domain_per_client UNIQUE (client_id, domain);


--
-- Name: widget_usage widget_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.widget_usage
    ADD CONSTRAINT widget_usage_pkey PRIMARY KEY (id);


--
-- Name: idx_api_keys_client_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_api_keys_client_active ON public.api_keys USING btree (client_id, is_active);


--
-- Name: idx_api_keys_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_api_keys_client_id ON public.api_keys USING btree (client_id);


--
-- Name: idx_api_keys_domain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_api_keys_domain ON public.api_keys USING btree (domain);


--
-- Name: idx_api_keys_key_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_api_keys_key_active ON public.api_keys USING btree (api_key, is_active);


--
-- Name: idx_api_usage_client_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_api_usage_client_date ON public.api_usage USING btree (client_id, date);


--
-- Name: idx_api_usage_endpoint; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_api_usage_endpoint ON public.api_usage USING btree (endpoint);


--
-- Name: idx_clients_stripe_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_stripe_customer_id ON public.clients USING btree (stripe_customer_id);


--
-- Name: idx_contact_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_client_id ON public.contact_messages USING btree (client_id);


--
-- Name: idx_contact_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_created_at ON public.contact_messages USING btree (created_at DESC);


--
-- Name: idx_contact_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_priority ON public.contact_messages USING btree (priority);


--
-- Name: idx_contact_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_status ON public.contact_messages USING btree (status);


--
-- Name: idx_custom_places_api_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_custom_places_api_key ON public.client_custom_places USING btree (api_key_id);


--
-- Name: idx_custom_places_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_custom_places_client ON public.client_custom_places USING btree (client_id);


--
-- Name: idx_custom_places_cloudinary_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_custom_places_cloudinary_id ON public.client_custom_places USING btree (cloudinary_public_id);


--
-- Name: idx_custom_places_coordinates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_custom_places_coordinates ON public.client_custom_places USING btree (latitude, longitude) WHERE (show_on_map = true);


--
-- Name: idx_custom_places_country; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_custom_places_country ON public.client_custom_places USING btree (country_id);


--
-- Name: idx_deletion_feedback_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deletion_feedback_client_id ON public.account_deletion_feedback USING btree (client_id);


--
-- Name: idx_deletion_feedback_deletion_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deletion_feedback_deletion_date ON public.account_deletion_feedback USING btree (deletion_date);


--
-- Name: idx_deletion_feedback_leave_reason; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deletion_feedback_leave_reason ON public.account_deletion_feedback USING btree (leave_reason);


--
-- Name: idx_deletion_feedback_rating; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deletion_feedback_rating ON public.account_deletion_feedback USING btree (rating);


--
-- Name: idx_export_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_export_client ON public.export_downloads USING btree (client_id);


--
-- Name: idx_export_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_export_date ON public.export_downloads USING btree (downloaded_at);


--
-- Name: idx_extra_domains_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_extra_domains_client_id ON public.extra_domains USING btree (client_id);


--
-- Name: idx_extra_domains_domain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_extra_domains_domain ON public.extra_domains USING btree (domain);


--
-- Name: idx_extra_domains_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_extra_domains_status ON public.extra_domains USING btree (status);


--
-- Name: idx_extra_domains_stripe_sub; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_extra_domains_stripe_sub ON public.extra_domains USING btree (stripe_subscription_id);


--
-- Name: idx_gdpr_requests_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gdpr_requests_created_at ON public.gdpr_requests USING btree (created_at);


--
-- Name: idx_gdpr_requests_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gdpr_requests_email ON public.gdpr_requests USING btree (email);


--
-- Name: idx_gdpr_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gdpr_requests_status ON public.gdpr_requests USING btree (status);


--
-- Name: idx_gdpr_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gdpr_requests_user_id ON public.gdpr_requests USING btree (user_id);


--
-- Name: idx_payment_logs_downloads; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_logs_downloads ON public.payment_logs USING btree (id, download_count, last_download_at);


--
-- Name: idx_payment_logs_subscription_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_logs_subscription_id ON public.payment_logs USING btree (subscription_id);


--
-- Name: idx_renewal_reminders_subscription; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_renewal_reminders_subscription ON public.renewal_reminders USING btree (subscription_id);


--
-- Name: idx_subscriptions_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscriptions_client_id ON public.subscriptions USING btree (client_id);


--
-- Name: idx_subscriptions_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscriptions_is_active ON public.subscriptions USING btree (is_active);


--
-- Name: idx_subscriptions_plan_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscriptions_plan_type ON public.subscriptions USING btree (plan_type);


--
-- Name: idx_subscriptions_stripe_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions USING btree (stripe_customer_id);


--
-- Name: idx_subscriptions_stripe_subscription_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscriptions_stripe_subscription_id ON public.subscriptions USING btree (stripe_subscription_id);


--
-- Name: idx_usage_client_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usage_client_created ON public.widget_usage USING btree (client_id, created_at);


--
-- Name: idx_usage_client_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usage_client_date ON public.widget_usage USING btree (client_id, date);


--
-- Name: idx_usage_event_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usage_event_type ON public.widget_usage USING btree (event_type);


--
-- Name: idx_usage_widget_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usage_widget_type ON public.widget_usage USING btree (widget_type);


--
-- Name: idx_widget_usage_client_domain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_widget_usage_client_domain ON public.widget_usage USING btree (client_id, domain);


--
-- Name: idx_widget_usage_client_domain_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_widget_usage_client_domain_date ON public.widget_usage USING btree (client_id, domain, created_at DESC);


--
-- Name: idx_widget_usage_domain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_widget_usage_domain ON public.widget_usage USING btree (domain);


--
-- Name: idx_widget_usage_is_opening; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_widget_usage_is_opening ON public.widget_usage USING btree (client_id, is_opening, created_at);


--
-- Name: idx_widget_usage_widget_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_widget_usage_widget_type ON public.widget_usage USING btree (widget_type);


--
-- Name: subscriptions_client_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX subscriptions_client_id_key ON public.subscriptions USING btree (client_id);


--
-- Name: extra_domains prevent_base_domain_in_extra; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER prevent_base_domain_in_extra BEFORE INSERT OR UPDATE ON public.extra_domains FOR EACH ROW EXECUTE FUNCTION public.check_domain_not_base();


--
-- Name: TRIGGER prevent_base_domain_in_extra ON extra_domains; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TRIGGER prevent_base_domain_in_extra ON public.extra_domains IS 'Trigger que previene insertar el dominio base en extra_domains';


--
-- Name: subscriptions track_subscription_changes; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER track_subscription_changes AFTER UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.log_subscription_change();


--
-- Name: contact_messages trigger_update_contact_messages_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_contact_messages_timestamp BEFORE UPDATE ON public.contact_messages FOR EACH ROW EXECUTE FUNCTION public.update_contact_messages_updated_at();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: api_keys api_keys_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: api_usage api_usage_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_usage
    ADD CONSTRAINT api_usage_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE SET NULL;


--
-- Name: api_usage api_usage_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_usage
    ADD CONSTRAINT api_usage_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_custom_places client_custom_places_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_custom_places
    ADD CONSTRAINT client_custom_places_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE CASCADE;


--
-- Name: client_custom_places client_custom_places_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_custom_places
    ADD CONSTRAINT client_custom_places_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: contact_messages contact_messages_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: export_downloads export_downloads_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.export_downloads
    ADD CONSTRAINT export_downloads_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: extra_domains extra_domains_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.extra_domains
    ADD CONSTRAINT extra_domains_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_custom_places fk_custom_places_api_key; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_custom_places
    ADD CONSTRAINT fk_custom_places_api_key FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id);


--
-- Name: client_custom_places fk_custom_places_country; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_custom_places
    ADD CONSTRAINT fk_custom_places_country FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE SET NULL;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: subscription_history subscription_history_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_history
    ADD CONSTRAINT subscription_history_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: widget_usage widget_usage_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.widget_usage
    ADD CONSTRAINT widget_usage_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE SET NULL;


--
-- Name: widget_usage widget_usage_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.widget_usage
    ADD CONSTRAINT widget_usage_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--
-----Last Update
ALTER TABLE client_custom_places 
ADD COLUMN IF NOT EXISTS domain VARCHAR(255);

-- Actualizar los registros existentes con el dominio base del cliente
UPDATE client_custom_places ccp
SET domain = c.domain
FROM clients c
WHERE ccp.client_id = c.id
AND ccp.domain IS NULL;
