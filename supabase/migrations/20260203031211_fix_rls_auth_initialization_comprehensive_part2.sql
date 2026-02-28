/*
  # Fix RLS Auth Initialization - Comprehensive Part 2

  ## Tables covered:
    - Workflow: workflow_instances, workflow_approvals, workflow_history
    - Contracts & Reviews: contract_reviews, contracts, due_diligence
    - Support tables: subcontractors, performance_reviews
    - Organization config: organization_tier_config, organization_osfi_weights
    - Senior approval: senior_approval_config, senior_approvers
*/

-- workflow_instances
DROP POLICY IF EXISTS "Authorized users can insert workflow_instances" ON workflow_instances;
DROP POLICY IF EXISTS "Authorized users can update workflow_instances" ON workflow_instances;
CREATE POLICY "Authorized users can insert workflow_instances" ON workflow_instances FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou INNER JOIN vendors v ON v.organization_id = ou.organization_id WHERE v.id = workflow_instances.entity_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));
CREATE POLICY "Authorized users can update workflow_instances" ON workflow_instances FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou INNER JOIN vendors v ON v.organization_id = ou.organization_id WHERE v.id = workflow_instances.entity_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou INNER JOIN vendors v ON v.organization_id = ou.organization_id WHERE v.id = workflow_instances.entity_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- workflow_approvals
DROP POLICY IF EXISTS "Approvers can update own workflow_approvals" ON workflow_approvals;
CREATE POLICY "Approvers can update own workflow_approvals" ON workflow_approvals FOR UPDATE TO authenticated USING (approver_user_id = (SELECT auth.uid()) OR delegated_to = (SELECT auth.uid())) WITH CHECK (approver_user_id = (SELECT auth.uid()) OR delegated_to = (SELECT auth.uid()));

-- workflow_history
DROP POLICY IF EXISTS "Authorized users can read workflow history" ON workflow_history;
CREATE POLICY "Authorized users can read workflow history" ON workflow_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou INNER JOIN vendors v ON v.organization_id = ou.organization_id WHERE v.id = workflow_history.entity_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- contract_reviews
DROP POLICY IF EXISTS "Authorized users can manage contract_reviews" ON contract_reviews;
CREATE POLICY "Authorized users can manage contract_reviews" ON contract_reviews FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM contracts c INNER JOIN vendors v ON v.id = c.vendor_id INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE c.id = contract_reviews.contract_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM contracts c INNER JOIN vendors v ON v.id = c.vendor_id INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE c.id = contract_reviews.contract_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- contracts
DROP POLICY IF EXISTS "Authorized users can manage contracts" ON contracts;
CREATE POLICY "Authorized users can manage contracts" ON contracts FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = contracts.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = contracts.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- due_diligence
DROP POLICY IF EXISTS "Authorized users can manage due_diligence" ON due_diligence;
CREATE POLICY "Authorized users can manage due_diligence" ON due_diligence FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = due_diligence.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = due_diligence.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- subcontractors
DROP POLICY IF EXISTS "Authorized users can manage subcontractors" ON subcontractors;
CREATE POLICY "Authorized users can manage subcontractors" ON subcontractors FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = subcontractors.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = subcontractors.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- performance_reviews
DROP POLICY IF EXISTS "Authorized users can manage performance_reviews" ON performance_reviews;
CREATE POLICY "Authorized users can manage performance_reviews" ON performance_reviews FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = performance_reviews.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM vendors v INNER JOIN organization_users ou ON ou.organization_id = v.organization_id WHERE v.id = performance_reviews.vendor_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- organization_tier_config
DROP POLICY IF EXISTS "Organization admins can manage tier config" ON organization_tier_config;
DROP POLICY IF EXISTS "Organization members can view tier config" ON organization_tier_config;
CREATE POLICY "Organization admins can manage tier config" ON organization_tier_config FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = organization_tier_config.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = organization_tier_config.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Organization members can view tier config" ON organization_tier_config FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = organization_tier_config.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- organization_osfi_weights
DROP POLICY IF EXISTS "Organization admins can manage OSFI weights" ON organization_osfi_weights;
DROP POLICY IF EXISTS "Organization members can view OSFI weights" ON organization_osfi_weights;
CREATE POLICY "Organization admins can manage OSFI weights" ON organization_osfi_weights FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = organization_osfi_weights.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = organization_osfi_weights.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Organization members can view OSFI weights" ON organization_osfi_weights FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = organization_osfi_weights.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- senior_approval_config
DROP POLICY IF EXISTS "Admins can manage senior approval config" ON senior_approval_config;
DROP POLICY IF EXISTS "Users can view senior approval config for their organization" ON senior_approval_config;
CREATE POLICY "Admins can manage senior approval config" ON senior_approval_config FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = senior_approval_config.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = senior_approval_config.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Users can view senior approval config for their organization" ON senior_approval_config FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = senior_approval_config.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));

-- senior_approvers
DROP POLICY IF EXISTS "Admins can manage senior approvers" ON senior_approvers;
DROP POLICY IF EXISTS "Users can view senior approvers for their organization" ON senior_approvers;
CREATE POLICY "Admins can manage senior approvers" ON senior_approvers FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = senior_approvers.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true)) WITH CHECK (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = senior_approvers.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.can_configure_workflows = true AND ou.is_active = true));
CREATE POLICY "Users can view senior approvers for their organization" ON senior_approvers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM organization_users ou WHERE ou.organization_id = senior_approvers.organization_id AND ou.user_id = (SELECT auth.uid()) AND ou.is_active = true));