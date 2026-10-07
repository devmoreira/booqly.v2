// Service worker — fica rodando em segundo plano no navegador do
// cliente, mesmo com a aba do Booqly fechada. Só faz duas coisas:
// mostrar a notificação quando ela chega, e abrir a página certa
// quando a pessoa clica nela.

self.addEventListener("push", (evento) => {
  const dados = evento.data ? evento.data.json() : {};
  const titulo = dados.titulo || "Booqly";
  const opcoes = {
    body: dados.corpo || "",
    icon: "/icone-notificacao.png",
    data: { url: dados.url || "/cliente" },
  };
  evento.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = evento.notification.data?.url || "/cliente";
  evento.waitUntil(
    self.clients.matchAll({ type: "window" }).then((listaDeAbas) => {
      for (const aba of listaDeAbas) {
        if (aba.url.includes(url) && "focus" in aba) return aba.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
