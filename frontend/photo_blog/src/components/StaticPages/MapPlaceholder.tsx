import { motion } from 'framer-motion';
import GlobeView from './GlobeView';

export default function MapContent() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ width: '100%', height: '100%', padding: 8 }}
    >
      <GlobeView />
    </motion.div>
  );
}
