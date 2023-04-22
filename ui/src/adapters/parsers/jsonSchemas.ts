import { z } from "zod";

import { getStrictParser } from "src/adapters/parsers";
import {
  ArrayAttribute,
  ArrayAttributeValue,
  Attribute,
  AttributeValue,
  BooleanAttribute,
  BooleanAttributeValue,
  BooleanProps,
  BooleanSchema,
  CommonProps,
  IntegerAttribute,
  IntegerAttributeValue,
  IntegerProps,
  IntegerSchema,
  JsonLdType,
  JsonSchema,
  MultiAttribute,
  MultiAttributeValue,
  MultiSchema,
  MultiValue,
  NullAttribute,
  NullAttributeValue,
  NullSchema,
  NumberAttribute,
  NumberAttributeValue,
  NumberProps,
  NumberSchema,
  ObjectAttribute,
  ObjectAttributeValue,
  ObjectProps,
  SchemaProps,
  StringAttribute,
  StringAttributeValue,
  StringProps,
  StringSchema,
} from "src/domain";

const commonPropsParser = getStrictParser<CommonProps>()(
  z.object({
    description: z.string().optional(),
    title: z.string().optional(),
  })
);

// Primitives

const booleanPropsParser = getStrictParser<BooleanProps>()(
  z.object({
    enum: z.boolean().array().min(1).optional(),
  })
);

const booleanSchemaParser = getStrictParser<BooleanSchema>()(
  commonPropsParser.and(booleanPropsParser).and(
    z.object({
      type: z.literal("boolean"),
    })
  )
);

function getBooleanAttributeParser(name: string, required: boolean) {
  return getStrictParser<BooleanSchema, BooleanAttribute>()(
    booleanSchemaParser.transform(
      (schema): BooleanAttribute => ({
        name,
        required,
        schema,
        type: "boolean",
      })
    )
  );
}

const integerPropsParser = getStrictParser<IntegerProps>()(
  z.object({
    enum: z.number().array().min(1).optional(),
  })
);

const integerSchemaParser = getStrictParser<IntegerSchema>()(
  commonPropsParser.and(integerPropsParser).and(
    z.object({
      type: z.literal("integer"),
    })
  )
);

function getIntegerAttributeParser(name: string, required: boolean) {
  return getStrictParser<IntegerSchema, IntegerAttribute>()(
    integerSchemaParser.transform(
      (schema): IntegerAttribute => ({
        name,
        required,
        schema,
        type: "integer",
      })
    )
  );
}

const nullSchemaParser = getStrictParser<NullSchema>()(
  commonPropsParser.and(
    z.object({
      type: z.literal("null"),
    })
  )
);

function getNullAttributeParser(name: string, required: boolean) {
  return getStrictParser<NullSchema, NullAttribute>()(
    nullSchemaParser.transform(
      (schema): NullAttribute => ({
        name,
        required,
        schema,
        type: "null",
      })
    )
  );
}

const numberPropsParser = getStrictParser<NumberProps>()(
  z.object({
    enum: z.number().array().min(1).optional(),
  })
);

const numberSchemaParser = getStrictParser<NumberSchema>()(
  commonPropsParser.and(numberPropsParser).and(
    z.object({
      type: z.literal("number"),
    })
  )
);

function getNumberAttributeParser(name: string, required: boolean) {
  return getStrictParser<NumberSchema, NumberAttribute>()(
    numberSchemaParser.transform(
      (schema): NumberAttribute => ({
        name,
        required,
        schema,
        type: "number",
      })
    )
  );
}

const stringPropsParser = getStrictParser<StringProps>()(
  z.object({
    enum: z.string().array().min(1).optional(),
    format: z.string().optional(),
  })
);

const stringSchemaParser = getStrictParser<StringSchema>()(
  commonPropsParser.and(stringPropsParser).and(
    z.object({
      type: z.literal("string"),
    })
  )
);

function getStringAttributeParser(name: string, required: boolean) {
  return getStrictParser<StringSchema, StringAttribute>()(
    stringSchemaParser.transform(
      (schema): StringAttribute => ({
        name,
        required,
        schema,
        type: "string",
      })
    )
  );
}

// Non-primitive

type ArrayPropsInput = {
  items?: unknown;
};

type ArraySchemaInput = CommonProps & ArrayPropsInput & { type: "array" };

const arrayPropsInputParser = getStrictParser<ArrayPropsInput>()(
  z.object({
    items: z.unknown().optional(),
  })
);

const arraySchemaInputParser = getStrictParser<ArraySchemaInput>()(
  commonPropsParser.and(arrayPropsInputParser).and(
    z.object({
      type: z.literal("array"),
    })
  )
);

function getArrayAttributeParser(name: string, required: boolean) {
  return getStrictParser<ArraySchemaInput, ArrayAttribute>()(
    arraySchemaInputParser.transform(
      (schema): ArrayAttribute => ({
        name,
        required,
        schema: {
          ...schema,
          items: schema.items
            ? getAttributeParser("items", required).parse(schema.items)
            : undefined,
        },
        type: "array",
      })
    )
  );
}

type ObjectPropsInput = Omit<ObjectProps, "properties"> & {
  properties?: Record<string, unknown>;
};

type ObjectSchemaInput = CommonProps & ObjectPropsInput & { type: "object" };

const objectPropsInputParser = getStrictParser<ObjectPropsInput>()(
  z.object({
    properties: z.record(z.unknown()).optional(),
    required: z.string().array().optional(),
  })
);

const objectSchemaInputParser = getStrictParser<ObjectSchemaInput>()(
  commonPropsParser.and(objectPropsInputParser).and(
    z.object({
      type: z.literal("object"),
    })
  )
);

function getObjectAttributeParser(name: string, required: boolean) {
  return getStrictParser<ObjectSchemaInput, ObjectAttribute>()(
    objectSchemaInputParser.transform(
      (schema): ObjectAttribute => ({
        name,
        required,
        schema: {
          ...schema,
          properties:
            schema.properties &&
            Object.entries(schema.properties)
              .map(([name, value]) =>
                getAttributeParser(
                  name,
                  schema.required !== undefined && schema.required.includes(name)
                ).parse(value)
              )
              .sort((a, b) =>
                a.type !== "object" && b.type !== "object" ? 0 : a.type === "object" ? 1 : -1
              ),
        },
        type: "object",
      })
    )
  );
}

// Multi-type

type MultiSchemaType = {
  type: (
    | BooleanSchema["type"]
    | IntegerSchema["type"]
    | NullSchema["type"]
    | NumberSchema["type"]
    | StringSchema["type"]
    | ArraySchemaInput["type"]
    | ObjectSchemaInput["type"]
  )[];
};

type MultiProps = StringProps &
  IntegerProps &
  NumberProps &
  BooleanProps &
  ObjectPropsInput &
  ArrayPropsInput;

type MultiSchemaInput = CommonProps & MultiProps & MultiSchemaType;

const multiPropsParser = getStrictParser<MultiProps>()(
  stringPropsParser
    .and(integerPropsParser)
    .and(numberPropsParser)
    .and(booleanPropsParser)
    .and(objectPropsInputParser)
    .and(arrayPropsInputParser)
);

const multiSchemaTypeParser = getStrictParser<MultiSchemaType>()(
  z.object({
    type: z
      .union([
        z.literal("string"),
        z.literal("integer"),
        z.literal("number"),
        z.literal("boolean"),
        z.literal("null"),
        z.literal("object"),
        z.literal("array"),
      ])
      .array()
      .min(2),
  })
);

function getMultiAttributeParser(name: string, required: boolean) {
  return getStrictParser<MultiSchemaInput, MultiAttribute>()(
    commonPropsParser
      .and(multiPropsParser)
      .and(multiSchemaTypeParser)
      .transform(
        (schema): MultiAttribute => ({
          name,
          required,
          schemas: schema.type.map((type): MultiSchema => {
            switch (type) {
              case "boolean": {
                return getBooleanAttributeParser(name, required).parse({
                  ...schema,
                  type: "boolean",
                }).schema;
              }
              case "integer": {
                return getIntegerAttributeParser(name, required).parse({
                  ...schema,
                  type: "integer",
                }).schema;
              }
              case "null": {
                return getNullAttributeParser(name, required).parse({ ...schema, type: "null" })
                  .schema;
              }
              case "number": {
                return getNumberAttributeParser(name, required).parse({ ...schema, type: "number" })
                  .schema;
              }
              case "string": {
                return getStringAttributeParser(name, required).parse({ ...schema, type: "string" })
                  .schema;
              }
              case "array": {
                return getArrayAttributeParser(name, required).parse({ ...schema, type: "array" })
                  .schema;
              }
              case "object": {
                return getObjectAttributeParser(name, required).parse({ ...schema, type: "object" })
                  .schema;
              }
            }
          }),
          type: "multi",
        })
      )
  );
}

// Schema

type AnySchema =
  | BooleanSchema
  | IntegerSchema
  | NullSchema
  | NumberSchema
  | StringSchema
  | ArraySchemaInput
  | ObjectSchemaInput
  | MultiSchemaInput;

type SchemaInput = AnySchema & SchemaProps;

const schemaPropsParser = getStrictParser<SchemaProps>()(
  z.object({
    $metadata: z.object({ uris: z.object({ jsonLdContext: z.string() }) }),
  })
);

function getAttributeParser(name: string, required: boolean) {
  return getStrictParser<AnySchema, Attribute>()(
    z.union([
      getBooleanAttributeParser(name, required),
      getIntegerAttributeParser(name, required),
      getNullAttributeParser(name, required),
      getNumberAttributeParser(name, required),
      getStringAttributeParser(name, required),
      getArrayAttributeParser(name, required),
      getObjectAttributeParser(name, required),
      getMultiAttributeParser(name, required),
    ])
  );
}

export const jsonSchemaParser = getStrictParser<SchemaInput, JsonSchema>()(
  schemaPropsParser.and(getAttributeParser("schema", false))
);

// JSON LD Type

function getIden3JsonLdTypeParser(schema: JsonSchema) {
  return getStrictParser<
    {
      "@context": [Record<string, unknown>];
    },
    JsonLdType[]
  >()(
    z
      .object({
        "@context": z.tuple([z.record(z.unknown())]),
      })
      .transform((ldContext, zodContext): JsonLdType[] => {
        const schemaCredentialSubject =
          schema.type === "object" && schema.schema.properties
            ? schema.schema.properties.reduce(
                (acc: ObjectAttribute | undefined, curr: Attribute) =>
                  curr.type === "object" && curr.name === "credentialSubject" ? curr : acc,
                undefined
              )
            : undefined;

        if (!schemaCredentialSubject) {
          zodContext.addIssue({
            code: z.ZodIssueCode.custom,
            fatal: true,
            message: "Couldn't find attribute credentialSubject in the schema",
          });
          return z.NEVER;
        }

        const ldContextTypeParseResult = Object.entries(ldContext["@context"][0]).reduce(
          (acc: { success: false } | { success: true; value: JsonLdType[] }, [key, value]) => {
            const parsedValue = z
              .object({
                "@context": z.record(z.unknown()),
                "@id": z.string().url("Property @id of the type is not a valid URL"),
              })
              .safeParse(value);

            const ldContextTypePropsParseResult = parsedValue.success
              ? schemaCredentialSubject.schema.properties?.reduce(
                  (acc: { success: true } | { error: string; success: false }, attribute) =>
                    acc.success && attribute.name in parsedValue.data["@context"]
                      ? acc
                      : {
                          error: `Couldn't find Property "${attribute.name}" of the JSON schema in the context`,
                          success: false,
                        },
                  { success: true }
                ) || {
                  error: "Couldn't find any properties in schema's credentialSubject",
                  success: false,
                }
              : { error: parsedValue.error.message, success: false };

            return parsedValue.success && ldContextTypePropsParseResult.success
              ? {
                  success: true,
                  value: acc.success
                    ? [...acc.value, { id: parsedValue.data["@id"], name: key }]
                    : [{ id: parsedValue.data["@id"], name: key }],
                }
              : acc;
          },
          { success: false }
        );

        if (ldContextTypeParseResult.success) {
          return ldContextTypeParseResult.value;
        } else {
          zodContext.addIssue({
            code: z.ZodIssueCode.custom,
            fatal: true,
            message: "Couldn't find any valid type in the JSON LD context of the schema",
          });
          return z.NEVER;
        }
      })
  );
}

function getSertoJsonLdTypeParser(schema: JsonSchema) {
  return getStrictParser<
    {
      "@context": Record<string, unknown>;
    },
    JsonLdType[]
  >()(
    z
      .object({
        "@context": z.record(z.unknown()),
      })
      .transform((ldContext, zodContext): JsonLdType[] => {
        const schemaCredentialSubject =
          schema.type === "object" && schema.schema.properties
            ? schema.schema.properties.reduce(
                (acc: ObjectAttribute | undefined, curr: Attribute) =>
                  curr.type === "object" && curr.name === "credentialSubject" ? curr : acc,
                undefined
              )
            : undefined;
        if (!schemaCredentialSubject) {
          zodContext.addIssue({
            code: z.ZodIssueCode.custom,
            fatal: true,
            message: "Couldn't find attribute credentialSubject in the schema",
          });

          return z.NEVER;
        }

        const { credentialSubject: ldContextCredentialSubject, "schema-id": schemaId } = z
          .object({
            credentialSubject: z.object({
              "@context": z.record(z.unknown()),
            }),
            "schema-id": z.string().url(),
          })
          .parse(ldContext["@context"]);

        const jsonLdTypeParseResult = Object.entries(ldContext["@context"]).reduce(
          (acc: { success: false } | { jsonLdType: JsonLdType; success: true }, [key, value]) => {
            const parsedValue = z.object({ "@id": z.literal("schema-id") }).safeParse(value);

            return !acc.success && parsedValue.success
              ? {
                  jsonLdType: { id: `${schemaId}${key}`, name: key },
                  success: true,
                }
              : acc;
          },
          { success: false }
        );

        const ldContextTypePropsParseResult = schemaCredentialSubject.schema.properties?.reduce(
          (acc: { success: true } | { error: string; success: false }, attribute) =>
            acc.success && attribute.name in ldContextCredentialSubject["@context"]
              ? acc
              : {
                  error: `Couldn't find Property "${attribute.name}" of the JSON schema in the context`,
                  success: false,
                },
          { success: true }
        ) || {
          error: "Couldn't find any properties in schema's credentialSubject",
          success: false,
        };

        if (jsonLdTypeParseResult.success && ldContextTypePropsParseResult.success) {
          return [jsonLdTypeParseResult.jsonLdType];
        } else {
          zodContext.addIssue({
            code: z.ZodIssueCode.custom,
            fatal: true,
            message: !ldContextTypePropsParseResult.success
              ? ldContextTypePropsParseResult.error
              : "Couldn't find any valid type in the JSON LD context of the schema",
          });

          return z.NEVER;
        }
      })
  );
}

export function getJsonLdTypeParser(schema: JsonSchema) {
  return getStrictParser<
    | {
        "@context": Record<string, unknown>;
      }
    | {
        "@context": [Record<string, unknown>];
      },
    JsonLdType[]
  >()(z.union([getIden3JsonLdTypeParser(schema), getSertoJsonLdTypeParser(schema)]));
}

// Values

function getBooleanAttributeValueParser({ name, required, schema, type }: BooleanAttribute) {
  return required
    ? getStrictParser<boolean, BooleanAttributeValue>()(
        z.boolean().transform(
          (value): BooleanAttributeValue => ({
            name,
            required,
            schema,
            type,
            value,
          })
        )
      )
    : getStrictParser<boolean | undefined, BooleanAttributeValue>()(
        z
          .boolean()
          .optional()
          .transform(
            (value): BooleanAttributeValue => ({
              name,
              required,
              schema,
              type,
              value,
            })
          )
      );
}

function getIntegerAttributeValueParser({ name, required, schema, type }: IntegerAttribute) {
  return required
    ? getStrictParser<number, IntegerAttributeValue>()(
        z.number().transform(
          (value): IntegerAttributeValue => ({
            name,
            required,
            schema,
            type,
            value,
          })
        )
      )
    : getStrictParser<number | undefined, IntegerAttributeValue>()(
        z
          .number()
          .optional()
          .transform(
            (value): IntegerAttributeValue => ({
              name,
              required,
              schema,
              type,
              value,
            })
          )
      );
}

function getNullAttributeValueParser({ name, required, schema, type }: NullAttribute) {
  return required
    ? getStrictParser<null, NullAttributeValue>()(
        z.null().transform(
          (value): NullAttributeValue => ({
            name,
            required,
            schema,
            type,
            value,
          })
        )
      )
    : getStrictParser<null | undefined, NullAttributeValue>()(
        z
          .null()
          .optional()
          .transform(
            (value): NullAttributeValue => ({
              name,
              required,
              schema,
              type,
              value,
            })
          )
      );
}

function getNumberAttributeValueParser({ name, required, schema, type }: NumberAttribute) {
  return required
    ? getStrictParser<number, NumberAttributeValue>()(
        z.number().transform(
          (value): NumberAttributeValue => ({
            name,
            required,
            schema,
            type,
            value,
          })
        )
      )
    : getStrictParser<number | undefined, NumberAttributeValue>()(
        z
          .number()
          .optional()
          .transform(
            (value): NumberAttributeValue => ({
              name,
              required,
              schema,
              type,
              value,
            })
          )
      );
}

function getStringAttributeValueParser({ name, required, schema, type }: StringAttribute) {
  return required
    ? getStrictParser<string, StringAttributeValue>()(
        z.string().transform(
          (value): StringAttributeValue => ({
            name,
            required,
            schema,
            type,
            value,
          })
        )
      )
    : getStrictParser<string | undefined, StringAttributeValue>()(
        z
          .string()
          .optional()
          .transform(
            (value): StringAttributeValue => ({
              name,
              required,
              schema,
              type,
              value,
            })
          )
      );
}

function getArrayAttributeValueParser({ name, required, schema, type }: ArrayAttribute) {
  const attribute = schema.items;
  return required
    ? getStrictParser<unknown[], ArrayAttributeValue>()(
        z.array(z.unknown()).transform(
          (unknowns): ArrayAttributeValue => ({
            name,
            required,
            schema,
            type,
            value: attribute
              ? unknowns.map((unknown) => {
                  return getAttributeValueParser(attribute).parse(unknown);
                })
              : [],
          })
        )
      )
    : getStrictParser<unknown[] | undefined, ArrayAttributeValue>()(
        z
          .array(z.unknown())
          .optional()
          .transform(
            (unknowns): ArrayAttributeValue => ({
              name,
              required,
              schema,
              type,
              value: attribute
                ? unknowns &&
                  unknowns.map((unknown) => {
                    return getAttributeValueParser(attribute).parse(unknown);
                  })
                : [],
            })
          )
      );
}

function getObjectAttributeValueParser({ name, required, schema, type }: ObjectAttribute) {
  return required
    ? getStrictParser<Record<string, unknown>, ObjectAttributeValue>()(
        z.record(z.unknown()).transform((object, context): ObjectAttributeValue => {
          const x: ObjectAttributeValue = {
            name,
            required,
            schema,
            type,
            value: Object.entries(object)
              .map(([name, value]): AttributeValue => {
                const attribute = schema.properties?.find((property) => property.name === name);
                if (attribute) {
                  return getAttributeValueParser(attribute).parse(value);
                } else {
                  context.addIssue({
                    code: z.ZodIssueCode.custom,
                    fatal: true,
                    message: `Could not find the attribute ${name} in the object's schema.`,
                  });
                  return z.NEVER;
                }
              })
              .sort((a, b) =>
                a.type !== "object" && b.type !== "object" ? 0 : a.type === "object" ? 1 : -1
              ),
          };
          return x;
        })
      )
    : getStrictParser<Record<string, unknown> | undefined, ObjectAttributeValue>()(
        z
          .record(z.unknown())
          .optional()
          .transform((object, context): ObjectAttributeValue => {
            return {
              name,
              required,
              schema,
              type,
              value: object
                ? Object.entries(object).map(([name, value]): AttributeValue => {
                    const attribute = schema.properties?.find((property) => property.name === name);
                    if (attribute) {
                      return getAttributeValueParser(attribute).parse(value);
                    } else {
                      context.addIssue({
                        code: z.ZodIssueCode.custom,
                        fatal: true,
                        message: `Could not find the attribute ${name} in the object's schema.`,
                      });
                      return z.NEVER;
                    }
                  })
                : undefined,
            };
          })
      );
}

function parseMultiValue({
  name,
  required,
  schema,
  unknown,
}: {
  name: string;
  required: boolean;
  schema: MultiSchema;
  unknown: unknown;
}) {
  switch (schema.type) {
    case "boolean": {
      return getBooleanAttributeValueParser({
        name,
        required,
        schema: schema,
        type: "boolean",
      }).safeParse(unknown);
    }
    case "integer": {
      return getIntegerAttributeValueParser({
        name,
        required,
        schema: schema,
        type: "integer",
      }).safeParse(unknown);
    }
    case "null": {
      return getNullAttributeValueParser({
        name,
        required,
        schema: schema,
        type: "null",
      }).safeParse(unknown);
    }
    case "number": {
      return getNumberAttributeValueParser({
        name,
        required,
        schema: schema,
        type: "number",
      }).safeParse(unknown);
    }
    case "string": {
      return getStringAttributeValueParser({
        name,
        required,
        schema: schema,
        type: "string",
      }).safeParse(unknown);
    }
    case "array": {
      return getArrayAttributeValueParser({
        name,
        required,
        schema: schema,
        type: "array",
      }).safeParse(unknown);
    }
    case "object": {
      return getObjectAttributeValueParser({
        name,
        required,
        schema: schema,
        type: "object",
      }).safeParse(unknown);
    }
  }
}

type MultiAttributeValueParseResult = { data: MultiValue; success: true } | { success: false };

function getMultiAttributeValueParser({ name, required, schemas, type }: MultiAttribute) {
  return getStrictParser<unknown, MultiAttributeValue>()(
    z.unknown().transform((unknown, context): MultiAttributeValue => {
      const value: MultiAttributeValueParseResult = schemas.reduce(
        (
          acc: MultiAttributeValueParseResult,
          schema: MultiSchema
        ): MultiAttributeValueParseResult => {
          if (acc.success) {
            return acc;
          } else {
            const result = parseMultiValue({
              name,
              required,
              schema,
              unknown,
            });
            return result.success ? result : acc;
          }
        },
        {
          success: false,
        }
      );

      if (value.success) {
        return {
          name,
          required,
          schemas,
          type,
          value: value.data,
        };
      } else {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          fatal: true,
          message: `Could not parse the value of the multi attribute "${name}" against any of of its schemas.`,
        });
        return z.NEVER;
      }
    })
  );
}

export function getAttributeValueParser(attribute: Attribute) {
  return getStrictParser<unknown, AttributeValue>()(
    z.unknown().transform((unknown) => {
      switch (attribute.type) {
        case "boolean": {
          return getBooleanAttributeValueParser(attribute).parse(unknown);
        }
        case "integer": {
          return getIntegerAttributeValueParser(attribute).parse(unknown);
        }
        case "null": {
          return getNullAttributeValueParser(attribute).parse(unknown);
        }
        case "number": {
          return getNumberAttributeValueParser(attribute).parse(unknown);
        }
        case "string": {
          return getStringAttributeValueParser(attribute).parse(unknown);
        }
        case "array": {
          return getArrayAttributeValueParser(attribute).parse(unknown);
        }
        case "object": {
          return getObjectAttributeValueParser(attribute).parse(unknown);
        }
        case "multi": {
          return getMultiAttributeValueParser(attribute).parse(unknown);
        }
      }
    })
  );
}
