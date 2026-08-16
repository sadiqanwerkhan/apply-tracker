import { z } from "zod";

// Input schemas live here — separate from the tool files — so they can be unit
// tested WITHOUT importing anything that touches the database. The tool files
// import these same schemas, so tests here validate the real contract.

export const findApplicationsInput = z.object({
  company: z
    .string()
    .optional()
    .describe("Partial company name to filter by, case-insensitive. Omit to list all applications."),
});

export const getApplicationDetailInput = z.object({
  applicationId: z.string().optional().describe("The application id from find_applications."),
  company: z.string().optional().describe("Company name, if you don't have an id."),
});

// Raw Zod shapes (the object's field map) — the MCP SDK's registerTool wants the
// shape, not the wrapped z.object. Exported so the MCP server can register these
// same tools without redefining their inputs.
export const findApplicationsShape = { company: findApplicationsInput.shape.company };
export const getApplicationDetailShape = {
  applicationId: getApplicationDetailInput.shape.applicationId,
  company: getApplicationDetailInput.shape.company,
};