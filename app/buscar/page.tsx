// A busca virou um overlay na própria página inicial — isso aqui só
// existe pra quem tiver o link antigo /buscar salvo não cair numa
// página quebrada.
import { redirect } from "next/navigation";

export default function BuscarRedirecionaPage() {
  redirect("/");
}
