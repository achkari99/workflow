import type { Express } from "express";
import { storage } from "../storage";

export function registerRootRoutes(app: Express) {
    app.get("/ping", (_req, res) => {
        res.json({ status: "ok" });
    });

    app.post("/api/seed", async (req, res) => {
        if (process.env.NODE_ENV === "production") {
            return res.status(403).json({ error: "Seed route is disabled in production" });
        }
        try {
            const existingWorkflows = await storage.getWorkflows();
            if (existingWorkflows.length > 0) {
                return res.json({ message: "Database already seeded" });
            }

            const workflow1 = await storage.createWorkflow({
                name: "Core Platform Launch",
                description: "Deploy production-ready platform with all core features",
                totalSteps: 8,
                currentStep: 3,
                isActive: true,
                status: "active",
                priority: "critical",
            });

            const stepData1 = [
                { name: "Discovery & Requirements", description: "Gather stakeholder requirements and define scope", status: "completed" },
                { name: "Architecture Design", description: "Design system architecture and data models", status: "completed" },
                { name: "Core Development", description: "Build core platform features", status: "active" },
                { name: "Integration Testing", description: "Test all integrations and data flows", status: "locked", requiresApproval: true },
                { name: "Security Audit", description: "Conduct security review and penetration testing", status: "locked" },
                { name: "Performance Optimization", description: "Optimize for speed and scalability", status: "locked" },
                { name: "Staging Deployment", description: "Deploy to staging environment", status: "locked", requiresApproval: true },
                { name: "Production Launch", description: "Go live with production deployment", status: "locked", requiresApproval: true },
            ];

            for (let i = 0; i < stepData1.length; i++) {
                const step = await storage.createStep({
                    workflowId: workflow1.id,
                    stepNumber: i + 1,
                    ...stepData1[i],
                    isCompleted: stepData1[i].status === "completed",
                });

                if (i === 2) {
                    await storage.createIntelDoc({
                        stepId: step.id,
                        title: "Development Guidelines",
                        content: "Follow our coding standards and ensure all code is reviewed before merging. Use feature branches and write meaningful commit messages.",
                        docType: "guideline",
                    });
                    await storage.createIntelDoc({
                        stepId: step.id,
                        title: "API Documentation",
                        content: "Refer to the API design document for endpoint specifications and authentication requirements.",
                        docType: "reference",
                    });
                }
            }

            const workflow2 = await storage.createWorkflow({
                name: "Q4 Analytics Dashboard",
                description: "Build comprehensive analytics dashboard for quarterly metrics",
                totalSteps: 5,
                currentStep: 1,
                isActive: false,
                status: "active",
                priority: "high",
            });

            const stepData2 = [
                { name: "Data Source Integration", description: "Connect all data sources", status: "active" },
                { name: "Dashboard Design", description: "Design dashboard layouts and visualizations", status: "locked" },
                { name: "Report Builder", description: "Create customizable report builder", status: "locked" },
                { name: "User Testing", description: "Conduct user testing sessions", status: "locked", requiresApproval: true },
                { name: "Launch", description: "Deploy analytics dashboard", status: "locked" },
            ];

            for (let i = 0; i < stepData2.length; i++) {
                await storage.createStep({
                    workflowId: workflow2.id,
                    stepNumber: i + 1,
                    name: stepData2[i].name,
                    description: stepData2[i].description,
                    status: stepData2[i].status,
                    requiresApproval: stepData2[i].requiresApproval || false,
                });
            }

            const workflow3 = await storage.createWorkflow({
                name: "Mobile App Redesign",
                description: "Complete redesign of mobile application UI/UX",
                totalSteps: 6,
                currentStep: 2,
                isActive: false,
                status: "active",
                priority: "medium",
            });

            const stepData3 = [
                { name: "User Research", description: "Conduct user research and interviews", status: "completed" },
                { name: "Wireframing", description: "Create low-fidelity wireframes", status: "active" },
                { name: "Visual Design", description: "Create high-fidelity mockups", status: "locked" },
                { name: "Prototyping", description: "Build interactive prototype", status: "locked" },
                { name: "Development Handoff", description: "Prepare design specs for development", status: "locked", requiresApproval: true },
                { name: "QA & Launch", description: "Quality assurance and launch", status: "locked" },
            ];

            for (let i = 0; i < stepData3.length; i++) {
                await storage.createStep({
                    workflowId: workflow3.id,
                    stepNumber: i + 1,
                    name: stepData3[i].name,
                    description: stepData3[i].description,
                    status: stepData3[i].status,
                    isCompleted: stepData3[i].status === "completed",
                    requiresApproval: stepData3[i].requiresApproval || false,
                });
            }

            await storage.createActivity({
                workflowId: workflow1.id,
                action: "workflow_started",
                description: "Core Platform Launch workflow initiated",
            });

            res.json({ message: "Database seeded successfully", activeWorkflow: workflow1 });
        } catch (error) {
            console.error("Seed error:", error);
            res.status(500).json({ error: "Failed to seed database" });
        }
    });
}
