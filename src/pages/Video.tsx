import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { VideoConference } from "@/components/VideoConference";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Video() {
  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-4xl mx-auto space-y-8"
        >
          {/* Header */}
          <motion.div variants={item}>
            <h1 className="text-2xl lg:text-3xl font-serif font-bold">Video Conferencing</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Secure video collaboration for your legal team
            </p>
          </motion.div>

          {/* Video Conference Component */}
          <motion.div variants={item}>
            <VideoConference />
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  );
}
