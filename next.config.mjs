/** @type {import('next').NextConfig} */
const nextConfig = {
  // Libera testar pelo celular/outro dispositivo via ngrok em desenvolvimento.
  // Como o endereço do ngrok muda toda vez que ele reinicia, use o coringa
  // abaixo (cobre qualquer subdomínio ngrok-free.app/dev) em vez de trocar
  // esse arquivo toda hora.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev"],
};
export default nextConfig;
