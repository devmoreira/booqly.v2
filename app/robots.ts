// Gera /robots.txt de verdade — sem isso, o pedido cai na rota
// dinâmica [slug] (tentando achar um profissional chamado "robots.txt"),
// gerando um erro barulhento no log toda vez que um robô de busca ou o
// próprio navegador pede esse arquivo (o que é bem comum).
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
  };
}
