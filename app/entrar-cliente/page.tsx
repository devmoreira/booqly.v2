// A entrada do cliente virou parte da tela de login unificada.
import { redirect } from "next/navigation";

export default function EntrarClienteRedirecionaPage() {
  redirect("/login");
}
