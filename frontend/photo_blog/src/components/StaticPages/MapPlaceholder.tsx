import { motion } from 'framer-motion';

export default function MapPlaceholder() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-muted)',
        gap: 12,
      }}
    >
      <span style={{ fontSize: 48 }}>🗺️</span>
      <img style={{
        width: "60%",
        height: "auto"
      }}
      src="https://imgs.search.brave.com/nUn8XRQwXWDvX6dz_W0PJf438bSvkGAOMz35IWHFzAs/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly91cGxv/YWQud2lraW1lZGlh/Lm9yZy93aWtpcGVk/aWEvY29tbW9ucy90/aHVtYi9mL2Y0L01l/cmNhdG9yX3Byb2pl/Y3Rpb25fU1cuanBn/LzUxMnB4LU1lcmNh/dG9yX3Byb2plY3Rp/b25fU1cuanBn"></img>
      <p style={{ fontSize: 14 }}>[TODO] Map view.</p>
    </motion.div>
  );
}
