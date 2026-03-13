import { NextResponse } from "next/server";
import { queryOne, transaction } from "@/lib/db";
import { applyCustomerProfileInTx } from "@/lib/orgHierarchy";
import { auditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import type { CreateOrganizationRequest } from "@/types/setup";

/** GET — Check if any active organization exists, or fetch by id for impersonation */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      // Platform impersonation: fetch specific org by ID
      const org = await queryOne<{ id: string; name: string }>(
        `SELECT id, name FROM organizations WHERE id = $1 AND is_active = true`,
        [id]
      );
      if (org) return NextResponse.json({ exists: true, org });
      return NextResponse.json({ exists: false });
    }

    const org = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM organizations WHERE is_active = true LIMIT 1`
    );

    if (org) {
      return NextResponse.json({ exists: true, org });
    }
    return NextResponse.json({ exists: false });
  } catch (err) {
    console.error("[organizations] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** POST — Create a new organization (setup wizard) */
export async function POST(request: Request) {
  try {
    const body: CreateOrganizationRequest = await request.json();
    const {
      orgName,
      baseCurrency,
      adminName,
      adminEmail,
      adminPassword,
      profileId,
      hierarchyLevels,
      selectedCommodities,
    } = body;

    // Validate required fields
    if (!orgName || !baseCurrency || !adminName || !adminEmail || !profileId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!adminPassword || adminPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Hash the password before the transaction
    const passwordHash = await hashPassword(adminPassword);

    // Check no org exists already
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM organizations WHERE is_active = true LIMIT 1`
    );
    if (existing) {
      return NextResponse.json(
        { error: "An organization already exists" },
        { status: 409 }
      );
    }

    const result = await transaction(async (tx) => {
      // 1. Create organization
      const orgRow = await tx.query(
        `INSERT INTO organizations (name, base_currency, settings, is_active)
         VALUES ($1, $2, '{}', true)
         RETURNING id, name`,
        [orgName, baseCurrency]
      );
      const org = orgRow.rows[0];

      // 2. Create org_settings
      await tx.query(
        `INSERT INTO org_settings (org_id, default_currency, reporting_currency)
         VALUES ($1, $2, $2)`,
        [org.id, baseCurrency]
      );

      // 3. Create admin user with hashed password (handle duplicate email)
      let emailToUse = adminEmail;
      const existingUser = await tx.query(
        `SELECT id FROM users WHERE email = $1`,
        [adminEmail]
      );
      if (existingUser.rows.length > 0) {
        const [localPart, domain] = adminEmail.split("@");
        emailToUse = `${localPart}+org${org.id.slice(0, 8)}@${domain}`;
      }

      const userRow = await tx.query(
        `INSERT INTO users (org_id, email, name, role_id, is_active, password_hash)
         VALUES ($1, $2, $3, 'admin', true, $4)
         RETURNING id, name, email`,
        [org.id, emailToUse, adminName, passwordHash]
      );
      const user = userRow.rows[0];

      // 4. Apply customer profile (creates hierarchy levels, enables plugins, merges settings)
      //    But first, if the user customized hierarchy labels, we need to apply profile then override
      await applyCustomerProfileInTx(tx, org.id, profileId, user.id, hierarchyLevels);

      // 5. Store selected commodities as org setting
      if (selectedCommodities && selectedCommodities.length > 0) {
        await tx.query(
          `UPDATE organizations SET settings = settings || $2::jsonb WHERE id = $1`,
          [org.id, JSON.stringify({ enabled_commodities: selectedCommodities })]
        );
      }

      return { org: { id: org.id, name: org.name }, user: { id: user.id, name: user.name, email: user.email } };
    });

    // Audit log (outside transaction is fine)
    await auditLog({
      orgId: result.org.id,
      userId: result.user.id,
      module: "kernel",
      entityType: "organization",
      entityId: result.org.id,
      action: "create",
      after: { orgName, baseCurrency, profileId, adminEmail },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[organizations] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
