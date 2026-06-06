import * as fs from 'fs'
import * as path from 'path'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ZodTypeAny } from 'zod'
import * as schemas from '../src/index.js'

type JsonSchemaObject = Record<string, unknown>

/**
 * Script to export all Zod schemas from @connectio/data-contracts to a single
 * JSON Schema file. This file is used as an intermediate representation to
 * generate Pydantic models for the FastAPI backend.
 */

async function main() {
  const outputDir = path.resolve(process.cwd(), 'dist-schema')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const jsonSchemaMap: Record<string, JsonSchemaObject> = {}

  // Iterate over all exported values from index.ts
  for (const [name, schema] of Object.entries(schemas)) {
    // We only care about objects that look like Zod schemas (usually end with 'Schema')
    if (name.endsWith('Schema') && typeof (schema as { parse?: unknown }).parse === 'function') {
      const modelName = name.replace(/Schema$/, '')
      const jsonSchema = zodToJsonSchema(schema as ZodTypeAny, modelName) as JsonSchemaObject
      jsonSchemaMap[modelName] = jsonSchema
    }
  }

  const combinedSchema: {
    $schema: string
    title: string
    type: string
    definitions: Record<string, unknown>
  } = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'ConnectIO Data Contracts',
    type: 'object',
    definitions: {},
  }

  for (const [modelName, schema] of Object.entries(jsonSchemaMap)) {
    const definitions = (schema as { definitions?: Record<string, unknown> }).definitions
    combinedSchema.definitions[modelName] = definitions?.[modelName] ?? schema
  }

  const outputPath = path.join(outputDir, 'contracts.json')
  // Post-process to transform anyOf [type: string, type: null] to type: [string, null] for better compatibility/readability
  let schemaString = JSON.stringify(combinedSchema, null, 2)

  // Regex to match the anyOf pattern produced by zodToJsonSchema for .nullable().optional()
  // "plannedStart": {
  //   "anyOf": [
  //     {
  //       "type": "string",
  //       "format": "date-time"
  //     },
  //     {
  //       "type": "null"
  //     }
  //   ]
  // }
  // ->
  // "plannedStart": {
  //   "type": ["string", "null"],
  //   "format": "date-time"
  // }
  schemaString = schemaString.replace(
    /"(\w+)":\s*{\s*"anyOf":\s*\[\s*{\s*"type":\s*"string",\s*"format":\s*"date-time"\s*},\s*{\s*"type":\s*"null"\s*}\s*]\s*}/g,
    '"$1": {\n      "type": ["string", "null"],\n      "format": "date-time"\n    }',
  )

  fs.writeFileSync(outputPath, schemaString)
  console.log(`Successfully exported JSON Schema to ${outputPath}`)
}

main().catch((err) => {
  console.error('Failed to export JSON Schema:', err)
  process.exit(1)
})
