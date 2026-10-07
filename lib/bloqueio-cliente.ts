// Bloqueio de cliente — vale pro ESTABELECIMENTO inteiro (profissional_id),
// não importa se quem bloqueou foi o dono ou um colaborador.
import { createAdminClient } from "@/lib/supabase/admin";

export async function clienteEstaBloqueado(profissionalId: string, clienteId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("clientes_bloqueados")
    .select("id")
    .eq("profissional_id", profissionalId)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  return !!data;
}

export async function bloquearCliente(profissionalId: string, clienteId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("clientes_bloqueados")
    .upsert({ profissional_id: profissionalId, cliente_id: clienteId }, { onConflict: "profissional_id,cliente_id" });
  return !error;
}

export async function desbloquearCliente(profissionalId: string, clienteId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("clientes_bloqueados")
    .delete()
    .eq("profissional_id", profissionalId)
    .eq("cliente_id", clienteId);
  return !error;
}

export async function listarBloqueados(profissionalId: string) {
  const admin = createAdminClient();
  const { data: bloqueios } = await admin
    .from("clientes_bloqueados")
    .select("id, cliente_id, bloqueado_em")
    .eq("profissional_id", profissionalId)
    .order("bloqueado_em", { ascending: false });

  const idsClientes = (bloqueios ?? []).map((b) => b.cliente_id);
  const { data: clientes } = idsClientes.length > 0
    ? await admin.from("clientes").select("id, nome, telefone").in("id", idsClientes)
    : { data: [] as { id: string; nome: string; telefone: string }[] };
  const mapaClientes = new Map((clientes ?? []).map((c) => [c.id, c]));

  return (bloqueios ?? []).map((b) => ({
    id: b.id,
    clienteId: b.cliente_id,
    bloqueadoEm: b.bloqueado_em,
    nome: mapaClientes.get(b.cliente_id)?.nome ?? "Cliente",
    telefone: mapaClientes.get(b.cliente_id)?.telefone ?? "",
  }));
}
