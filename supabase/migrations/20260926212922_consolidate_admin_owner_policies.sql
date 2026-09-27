BEGIN;

DROP POLICY IF EXISTS projects_admin_all ON public.projects;
CREATE POLICY projects_admin_insert ON public.projects
FOR INSERT TO authenticated
WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY projects_admin_update ON public.projects
FOR UPDATE TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY projects_admin_delete ON public.projects
FOR DELETE TO authenticated
USING ((SELECT private.is_admin()));

DROP POLICY IF EXISTS project_intakes_admin_all ON public.project_intakes;
CREATE POLICY project_intakes_admin_delete ON public.project_intakes
FOR DELETE TO authenticated
USING ((SELECT private.is_admin()));

DROP POLICY IF EXISTS bookmarks_admin_all ON public.bookmarks;
CREATE POLICY bookmarks_admin_insert ON public.bookmarks
FOR INSERT TO authenticated
WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY bookmarks_admin_update ON public.bookmarks
FOR UPDATE TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY bookmarks_admin_delete ON public.bookmarks
FOR DELETE TO authenticated
USING ((SELECT private.is_admin()));

COMMIT;
