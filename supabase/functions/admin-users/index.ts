import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-customer-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is an admin using service role client + auth header
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await adminClient.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { action, userId, data } = await req.json();

    switch (action) {
      case "list": {
        const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        if (error) throw error;
        return new Response(JSON.stringify({ users }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "delete": {
        if (userId === caller.id) {
          return new Response(JSON.stringify({ error: "Cannot delete yourself" }), { status: 400, headers: corsHeaders });
        }
        // Delete profile and roles first (cascade should handle, but be safe)
        await adminClient.from("user_roles").delete().eq("user_id", userId);
        await adminClient.from("profiles").delete().eq("id", userId);
        const { error } = await adminClient.auth.admin.deleteUser(userId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "update_role": {
        if (userId === caller.id) {
          return new Response(JSON.stringify({ error: "Cannot change own role" }), { status: 400, headers: corsHeaders });
        }
        // Get the caller's school_id to preserve tenancy
        const { data: callerRole } = await adminClient
          .from("user_roles")
          .select("school_id")
          .eq("user_id", caller.id)
          .single();
        await adminClient.from("user_roles").delete().eq("user_id", userId);
        await adminClient.from("user_roles").insert({ user_id: userId, role: data.role, school_id: callerRole?.school_id });
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "update_profile": {
        const updates: Record<string, string> = {};
        if (data.full_name !== undefined) updates.full_name = data.full_name;
        if (data.phone !== undefined) updates.phone = data.phone;
        await adminClient.from("profiles").update(updates).eq("id", userId);
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "create_user": {
        const phone = data.phone?.replace(/\D/g, '');
        const email = `${phone}@school.local`;
        const school_id = data.school_id || null;
        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email,
          password: data.password,
          email_confirm: true,
          user_metadata: { full_name: data.full_name || '', phone },
        });
        if (createErr) throw createErr;
        const newUserId = newUser.user.id;
        // Assign school_id to the profile
        if (school_id) {
          await adminClient.from("profiles").update({ school_id, full_name: data.full_name || '', phone }).eq("id", newUserId);
        }
        // Set role and school_id in user_roles (trigger creates a default 'parent' row)
        await adminClient.from("user_roles")
          .update({ role: data.role || 'parent', school_id })
          .eq("user_id", newUserId);
        return new Response(JSON.stringify({ success: true, userId: newUserId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "ban": {
        if (userId === caller.id) {
          return new Response(JSON.stringify({ error: "Cannot ban yourself" }), { status: 400, headers: corsHeaders });
        }
        const { error } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: data.banned ? "876000h" : "none",
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
    }
  } catch (err) {
    console.error('[admin-users] unhandled error:', err);
    return new Response(JSON.stringify({ error: 'حدث خطأ داخلي. يرجى المحاولة مرة أخرى.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
