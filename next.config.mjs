/** @type {import('next').NextConfig} */
const nextConfig = {
  // Telefon kamerasından gelen fotoğraflar büyük olabilir; API route body limitini yükselt.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
