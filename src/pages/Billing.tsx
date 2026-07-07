import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillableHours } from "@/components/BillableHours";
import { CourtCalendar } from "@/components/CourtCalendar";
import { DepositionManager } from "@/components/DepositionManager";
import { ClientCommunications } from "@/components/ClientCommunications";
import { LegalResearch } from "@/components/LegalResearch";
import { DollarSign, Calendar, Users, MessageSquare, BookOpen } from "lucide-react";

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

export default function Billing() {
  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-7xl mx-auto space-y-8"
        >
          {/* Header */}
          <motion.div variants={item}>
            <h1 className="text-2xl lg:text-3xl font-serif font-bold">Practice Management</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Billable hours, court calendar, depositions, and client communications
            </p>
          </motion.div>

          {/* Tabs */}
          <motion.div variants={item}>
            <Tabs defaultValue="billing" className="space-y-6">
              <TabsList className="grid grid-cols-5 w-full max-w-2xl">
                <TabsTrigger value="billing" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="hidden sm:inline">Billing</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Court</span>
                </TabsTrigger>
                <TabsTrigger value="depositions" className="gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Depositions</span>
                </TabsTrigger>
                <TabsTrigger value="communications" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Clients</span>
                </TabsTrigger>
                <TabsTrigger value="research" className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Research</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="billing">
                <BillableHours />
              </TabsContent>

              <TabsContent value="calendar">
                <CourtCalendar showUpcoming />
              </TabsContent>

              <TabsContent value="depositions">
                <DepositionManager />
              </TabsContent>

              <TabsContent value="communications">
                <ClientCommunications />
              </TabsContent>

              <TabsContent value="research">
                <LegalResearch />
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  );
}
