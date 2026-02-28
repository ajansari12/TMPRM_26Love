/*
  # Fix RLS Auth Initialization - Comprehensive Part 3

  ## Tables covered:
    - OSFI: osfi_b10_compliance_status, osfi_notifications, osfi_notification_templates
    - Organization: organization_invitations, organization_users
    - Vendor SLA: vendor_slas, sla_measurements
    - Auto-critical: auto_critical_rules
    - Risk: risk_exceptions
    - Fourth parties: fourth_parties
    - Platform: platform_admins, global_third_parties
*/

-- osfi_b10_compliance_status
DROP POLICY IF EXISTS "Organization users can delete their compliance status" ON osfi_b10_compliance_status;
DROP POLICY IF EXISTS "Organization users can insert compliance status" ON osfi_b10_compliance_status;
DROP POLICY IF EXISTS "Organization users can update their compliance status" ON osfi_b10_compliance_status;
DROP POLICY IF EXISTS "Organization users can view their compliance status" ON osfi_b10_compliance_status;
CREATE POLICY "Organization users can delete their compliance status" ON osfi_b10_compliance_status FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = osfi_b10_compliance_status.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization users can insert compliance status" ON osfi_b10_compliance_status FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = osfi_b10_compliance_status.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization users can update their compliance status" ON osfi_b10_compliance_status FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = osfi_b10_compliance_status.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = osfi_b10_compliance_status.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization users can view their compliance status" ON osfi_b10_compliance_status FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = osfi_b10_compliance_status.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- organization_invitations
DROP POLICY IF EXISTS "Organization admins can manage invitations" ON organization_invitations;
CREATE POLICY "Organization admins can manage invitations" ON organization_invitations FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = organization_invitations.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_manage_users = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = organization_invitations.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_manage_users = true AND ou.is_active = true));

-- vendor_slas
DROP POLICY IF EXISTS "Organization members can delete their vendor SLAs" ON vendor_slas;
DROP POLICY IF EXISTS "Organization members can insert vendor SLAs" ON vendor_slas;
DROP POLICY IF EXISTS "Organization members can update their vendor SLAs" ON vendor_slas;
DROP POLICY IF EXISTS "Organization members can view their vendor SLAs" ON vendor_slas;
CREATE POLICY "Organization members can delete their vendor SLAs" ON vendor_slas FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = vendor_slas.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can insert vendor SLAs" ON vendor_slas FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = vendor_slas.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can update their vendor SLAs" ON vendor_slas FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = vendor_slas.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = vendor_slas.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can view their vendor SLAs" ON vendor_slas FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = vendor_slas.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- sla_measurements
DROP POLICY IF EXISTS "Organization members can delete SLA measurements" ON sla_measurements;
DROP POLICY IF EXISTS "Organization members can insert SLA measurements" ON sla_measurements;
DROP POLICY IF EXISTS "Organization members can update SLA measurements" ON sla_measurements;
DROP POLICY IF EXISTS "Organization members can view SLA measurements" ON sla_measurements;
CREATE POLICY "Organization members can delete SLA measurements" ON sla_measurements FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM vendor_slas vs INNER JOIN vendors v ON v.id = vs.vendor_id INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE vs.id = sla_measurements.sla_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can insert SLA measurements" ON sla_measurements FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM vendor_slas vs INNER JOIN vendors v ON v.id = vs.vendor_id INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE vs.id = sla_measurements.sla_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can update SLA measurements" ON sla_measurements FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM vendor_slas vs INNER JOIN vendors v ON v.id = vs.vendor_id INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE vs.id = sla_measurements.sla_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendor_slas vs INNER JOIN vendors v ON v.id = vs.vendor_id INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE vs.id = sla_measurements.sla_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can view SLA measurements" ON sla_measurements FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM vendor_slas vs INNER JOIN vendors v ON v.id = vs.vendor_id INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE vs.id = sla_measurements.sla_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- auto_critical_rules
DROP POLICY IF EXISTS "Organization admins can create auto-critical rules" ON auto_critical_rules;
DROP POLICY IF EXISTS "Organization admins can delete auto-critical rules" ON auto_critical_rules;
DROP POLICY IF EXISTS "Organization admins can update auto-critical rules" ON auto_critical_rules;
DROP POLICY IF EXISTS "Organization members can view auto-critical rules" ON auto_critical_rules;
CREATE POLICY "Organization admins can create auto-critical rules" ON auto_critical_rules FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = auto_critical_rules.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Organization admins can delete auto-critical rules" ON auto_critical_rules FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = auto_critical_rules.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Organization admins can update auto-critical rules" ON auto_critical_rules FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = auto_critical_rules.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = auto_critical_rules.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Organization members can view auto-critical rules" ON auto_critical_rules FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = auto_critical_rules.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- risk_exceptions
DROP POLICY IF EXISTS "Organization members can delete risk exceptions" ON risk_exceptions;
DROP POLICY IF EXISTS "Organization members can insert risk exceptions" ON risk_exceptions;
DROP POLICY IF EXISTS "Organization members can update risk exceptions" ON risk_exceptions;
DROP POLICY IF EXISTS "Organization members can view their risk exceptions" ON risk_exceptions;
CREATE POLICY "Organization members can delete risk exceptions" ON risk_exceptions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = risk_exceptions.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can insert risk exceptions" ON risk_exceptions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = risk_exceptions.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can update risk exceptions" ON risk_exceptions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = risk_exceptions.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = risk_exceptions.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can view their risk exceptions" ON risk_exceptions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = risk_exceptions.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- fourth_parties
DROP POLICY IF EXISTS "Organization members can delete their fourth parties" ON fourth_parties;
DROP POLICY IF EXISTS "Organization members can insert fourth parties" ON fourth_parties;
DROP POLICY IF EXISTS "Organization members can update their fourth parties" ON fourth_parties;
DROP POLICY IF EXISTS "Organization members can view their fourth parties" ON fourth_parties;
CREATE POLICY "Organization members can delete their fourth parties" ON fourth_parties FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = fourth_parties.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can insert fourth parties" ON fourth_parties FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = fourth_parties.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can update their fourth parties" ON fourth_parties FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = fourth_parties.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = fourth_parties.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Organization members can view their fourth parties" ON fourth_parties FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = fourth_parties.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- platform_admins
DROP POLICY IF EXISTS "Platform admins can view themselves" ON platform_admins;
DROP POLICY IF EXISTS "Super admins can manage platform admins" ON platform_admins;
CREATE POLICY "Platform admins can view themselves" ON platform_admins FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Super admins can manage platform admins" ON platform_admins FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = (SELECT auth.uid()) AND pa.role = 'super_admin' AND pa.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = (SELECT auth.uid()) AND pa.role = 'super_admin' AND pa.is_active = true));

-- global_third_parties
DROP POLICY IF EXISTS "Authenticated users can view global third parties" ON global_third_parties;
CREATE POLICY "Authenticated users can view global third parties" ON global_third_parties FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);