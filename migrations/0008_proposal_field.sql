-- A résumé proposal can target one field of a role (title, company, dates, location,
-- summary) or a bullet point, not just a bullet's wording, so dates and titles can be
-- corrected through the MCP server like any other change.
ALTER TABLE resume_proposals ADD COLUMN field TEXT;
