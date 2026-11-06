BEGIN;
-- New installation: deliberately abort if an unrelated app_users table exists.
CREATE TABLE public.app_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 google_sub text NOT NULL UNIQUE CHECK (length(google_sub) BETWEEN 1 AND 255),
 email text NOT NULL CHECK (length(email) BETWEEN 3 AND 320),
 name text NOT NULL DEFAULT '' CHECK (length(name)<=200),
 avatar_url text NOT NULL DEFAULT '' CHECK (length(avatar_url)<=2048),
 created_at timestamptz NOT NULL DEFAULT now(),
 last_login_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz,
 is_blocked boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX app_users_email_unique ON public.app_users(lower(email));
CREATE INDEX app_users_seen_idx ON public.app_users(last_seen_at DESC) WHERE NOT is_blocked;
CREATE INDEX app_users_created_idx ON public.app_users(created_at DESC,id DESC);
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_users FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.app_users TO service_role;

CREATE FUNCTION public.subnexa_users_login_v1(p_sub text,p_email text,p_name text,p_avatar text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE blocked boolean;
BEGIN
 INSERT INTO public.app_users(google_sub,email,name,avatar_url,last_seen_at)
 VALUES(p_sub,lower(p_email),p_name,p_avatar,now())
 ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email,name=excluded.name,
 avatar_url=excluded.avatar_url,last_login_at=now(),
 last_seen_at=CASE WHEN public.app_users.is_blocked THEN public.app_users.last_seen_at ELSE now() END
 RETURNING is_blocked INTO blocked;
 RETURN NOT blocked;
END $$;

CREATE FUNCTION public.subnexa_users_ping_v1(p_sub text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE blocked boolean;
BEGIN
 SELECT is_blocked INTO blocked FROM public.app_users WHERE google_sub=p_sub;
 IF NOT FOUND THEN RETURN 'missing'; END IF;
 IF blocked THEN RETURN 'blocked'; END IF;
 UPDATE public.app_users SET last_seen_at=now() WHERE google_sub=p_sub AND NOT is_blocked;
 RETURN 'ok';
END $$;

CREATE FUNCTION public.subnexa_users_list_v1(p_search text DEFAULT '',p_page integer DEFAULT 1,
 p_size integer DEFAULT 20,p_online boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE total bigint; items jsonb;
BEGIN
 IF p_search IS NULL OR length(p_search)>100 OR p_page IS NULL OR p_page<1 OR p_page>100000
 OR p_size IS NULL OR p_size<1 OR p_size>50 OR p_online IS NULL THEN
 RAISE EXCEPTION 'Invalid pagination/search'; END IF;
 SELECT count(*) INTO total FROM public.app_users u
 WHERE (p_search='' OR strpos(lower(u.name),lower(p_search))>0 OR strpos(lower(u.email),lower(p_search))>0)
 AND (NOT p_online OR (NOT u.is_blocked AND u.last_seen_at>now()-interval '90 seconds'));
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO items FROM (
 SELECT name,email,avatar_url,created_at,last_login_at,last_seen_at,is_blocked
 FROM public.app_users u
 WHERE (p_search='' OR strpos(lower(u.name),lower(p_search))>0 OR strpos(lower(u.email),lower(p_search))>0)
 AND (NOT p_online OR (NOT u.is_blocked AND u.last_seen_at>now()-interval '90 seconds'))
 ORDER BY created_at DESC,id DESC LIMIT p_size OFFSET ((p_page-1)::bigint*p_size)
 ) x;
 RETURN jsonb_build_object('items',items,'total',total,'page',p_page,'page_size',p_size);
END $$;

CREATE FUNCTION public.subnexa_users_stats_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('total',count(*),
 'online',count(*) FILTER(WHERE NOT is_blocked AND last_seen_at>now()-interval '90 seconds'),
 'today',count(*) FILTER(WHERE created_at >= (date_trunc('day',now() AT TIME ZONE 'Asia/Colombo') AT TIME ZONE 'Asia/Colombo')),
 'week',count(*) FILTER(WHERE created_at >= (date_trunc('week',now() AT TIME ZONE 'Asia/Colombo') AT TIME ZONE 'Asia/Colombo')),
 'window_seconds',90) FROM public.app_users;
$$;
REVOKE ALL ON FUNCTION public.subnexa_users_login_v1(text,text,text,text),
 public.subnexa_users_ping_v1(text),public.subnexa_users_list_v1(text,integer,integer,boolean),
 public.subnexa_users_stats_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.subnexa_users_login_v1(text,text,text,text),
 public.subnexa_users_ping_v1(text),public.subnexa_users_list_v1(text,integer,integer,boolean),
 public.subnexa_users_stats_v1() TO service_role;
COMMIT;
