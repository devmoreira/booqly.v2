import { redirect } from "next/navigation";

// /admin sozinho nunca teve tela própria — manda pra um lugar sensato
// em vez de cair (por engano) na busca de estabelecimento por slug.
export default function AdminIndexPage() {
  redirect("/admin/pagamentos");
}
