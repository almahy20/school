import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://edara-arabiya.vercel.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-customer-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);
    const { data: { user: caller }, error: callerError } = await adminClient.auth.getUser(token);
    if (callerError || !caller) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role, school_id, is_super_admin")
      .eq("user_id", caller.id)
      .single();

    if (roleError || !roleData) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const callerIsSuperAdmin = roleData.is_super_admin === true;
    if (roleData.role !== "admin" && !callerIsSuperAdmin) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("school_id")
      .eq("id", caller.id)
      .single();

    const callerSchoolId = roleData.school_id || callerProfile?.school_id;
    if (!callerIsSuperAdmin && !callerSchoolId) {
      return jsonResponse({ error: "Forbidden: caller has no school scope" }, 403);
    }

    const { action, userId, data } = await req.json();

    const getTargetProfile = async (targetUserId: string) => {
      const { data: profileData, error } = await adminClient
        .from("profiles")
        .select("id, phone, role, school_id")
        .eq("id", targetUserId)
        .single();

      if (error || !profileData) return null;
      return profileData;
    };

    const ensureSameTenant = async (targetUserId: string) => {
      const profileData = await getTargetProfile(targetUserId);
      if (!profileData) {
        return { ok: false, response: jsonResponse({ error: "User not found" }, 404), profileData: null };
      }

      if (!callerIsSuperAdmin && profileData.school_id !== callerSchoolId) {
        return {
          ok: false,
          response: jsonResponse({ error: "Forbidden: cross-tenant access denied" }, 403),
          profileData,
        };
      }

      return { ok: true, response: null, profileData };
    };

    switch (action) {
      case "list": {
        const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        if (error) throw error;

        if (callerIsSuperAdmin) {
          return jsonResponse({ users });
        }

        const { data: scopedProfiles, error: profilesError } = await adminClient
          .from("profiles")
          .select("id")
          .eq("school_id", callerSchoolId);

        if (profilesError) throw profilesError;

        const scopedUserIds = new Set((scopedProfiles || []).map((profile) => profile.id));
        return jsonResponse({ users: users.filter((user) => scopedUserIds.has(user.id)) });
      }

      case "delete": {
        if (userId === caller.id) {
          return jsonResponse({ error: "Cannot delete yourself" }, 400);
        }

        const tenantCheck = await ensureSameTenant(userId);
        if (!tenantCheck.ok) return tenantCheck.response!;
        const profileData = tenantCheck.profileData!;

        const userRole = profileData.role;
        const userPhone = profileData.phone;

        console.log(`[Delete User] Deleting user ${userId} with role: ${userRole}`);

        if (userRole === "parent" && userPhone) {
          await adminClient
            .from("students")
            .update({ parent_phone: null })
            .eq("parent_phone", userPhone)
            .eq("school_id", profileData.school_id);

          await adminClient
            .from("student_parents")
            .delete()
            .eq("parent_id", userId);
        }

        if (userRole === "teacher") {
          await adminClient
            .from("classes")
            .update({ teacher_id: null })
            .eq("teacher_id", userId)
            .eq("school_id", profileData.school_id);
        }

        await adminClient
          .from("messages")
          .delete()
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

        await adminClient
          .from("complaints")
          .delete()
          .eq("user_id", userId);

        await adminClient
          .from("user_roles")
          .delete()
          .eq("user_id", userId);

        await adminClient
          .from("profiles")
          .delete()
          .eq("id", userId);

        const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
        if (authError) {
          return jsonResponse({
            success: false,
            error: `Failed to delete auth user: ${authError.message}`,
          }, 500);
        }

        return jsonResponse({
          success: true,
          message: "User deleted successfully",
        });
      }

      case "update_role": {
        if (userId === caller.id) {
          return jsonResponse({ error: "Cannot change own role" }, 400);
        }

        const tenantCheck = await ensureSameTenant(userId);
        if (!tenantCheck.ok) return tenantCheck.response!;

        const targetSchoolId = callerIsSuperAdmin
          ? tenantCheck.profileData!.school_id
          : callerSchoolId;

        await adminClient.from("user_roles").delete().eq("user_id", userId);
        await adminClient.from("user_roles").insert({
          user_id: userId,
          role: data.role,
          school_id: targetSchoolId,
        });

        return jsonResponse({ success: true });
      }

      case "update_status": {
        if (userId === caller.id) {
          return jsonResponse({ error: "Cannot change own status" }, 400);
        }

        const tenantCheck = await ensureSameTenant(userId);
        if (!tenantCheck.ok) return tenantCheck.response!;

        const allowedStatuses = new Set(["approved", "pending", "rejected"]);
        if (!allowedStatuses.has(data.status)) {
          return jsonResponse({ error: "Invalid status" }, 400);
        }

        await adminClient
          .from("user_roles")
          .update({ approval_status: data.status })
          .eq("user_id", userId);

        return jsonResponse({ success: true });
      }

      case "update_status_by_role_id": {
        const allowedStatuses = new Set(["approved", "pending", "rejected"]);
        if (!allowedStatuses.has(data.status)) {
          return jsonResponse({ error: "Invalid status" }, 400);
        }

        const { data: targetRole, error: targetRoleError } = await adminClient
          .from("user_roles")
          .select("id, user_id, school_id")
          .eq("id", data.userRoleId)
          .single();

        if (targetRoleError || !targetRole) {
          return jsonResponse({ error: "User role not found" }, 404);
        }

        if (targetRole.user_id === caller.id) {
          return jsonResponse({ error: "Cannot change own status" }, 400);
        }

        if (!callerIsSuperAdmin && targetRole.school_id !== callerSchoolId) {
          return jsonResponse({ error: "Forbidden: cross-tenant access denied" }, 403);
        }

        await adminClient
          .from("user_roles")
          .update({ approval_status: data.status })
          .eq("id", data.userRoleId);

        return jsonResponse({ success: true });
      }

      case "update_profile": {
        const tenantCheck = await ensureSameTenant(userId);
        if (!tenantCheck.ok) return tenantCheck.response!;

        const updates: Record<string, string> = {};
        if (data.full_name !== undefined) updates.full_name = data.full_name;
        if (data.phone !== undefined) updates.phone = data.phone;

        await adminClient.from("profiles").update(updates).eq("id", userId);
        return jsonResponse({ success: true });
      }

      case "create_user": {
        const phone = String(data.phone || "").replace(/\D/g, "");
        if (!phone || !data.password) {
          return jsonResponse({ error: "Phone and password are required" }, 400);
        }

        const fullName = data.full_name || data.fullName || "";
        const school_id = callerIsSuperAdmin ? (data.school_id || null) : callerSchoolId;
        if (!school_id) {
          return jsonResponse({ error: "School ID is required" }, 400);
        }

        const email = `${phone}@school.local`;
        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email,
          password: data.password,
          email_confirm: true,
          user_metadata: { full_name: fullName, phone },
        });

        if (createErr) throw createErr;

        const newUserId = newUser.user.id;
        await adminClient
          .from("profiles")
          .update({ school_id, full_name: fullName, phone })
          .eq("id", newUserId);

        await adminClient
          .from("user_roles")
          .update({ role: data.role || "parent", school_id })
          .eq("user_id", newUserId);

        return jsonResponse({ success: true, userId: newUserId });
      }

      case "ban": {
        if (userId === caller.id) {
          return jsonResponse({ error: "Cannot ban yourself" }, 400);
        }

        const tenantCheck = await ensureSameTenant(userId);
        if (!tenantCheck.ok) return tenantCheck.response!;

        const { error } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: data.banned ? "876000h" : "none",
        });

        if (error) throw error;
        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("[admin-users] unhandled error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
