const swaggerJsdoc = require("swagger-jsdoc");

const optionsV2 = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: "Mongokakaidee API Documentation (Swagger v2)",
      version: "2.0.0",
      description:
        "Swagger (OpenAPI 2.0) สำหรับ API V2 ทีม 4",
    },
    servers: [
      { url: "http://localhost:3000", description: "Development server" },
    ],

    tags: [
      { name: "Products v2", description: "Routes ใต้ /api/v2/products" },
      { name: "Import Products v2", description: "Routes ใต้ /api/v2/import-products" },
      { name: "Product Stocks", description: "Routes ใต้ /api/product-stocks" },
    ],

    paths: {
      "/api/v2/products": {
        get: {
          tags: ["Products v2"],
          summary: "Get products (pagination + filters)",
          parameters: [
            { name: "keyword", in: "query", type: "string", required: false },
            { name: "sku_code", in: "query", type: "string", required: false },
            { name: "category_code", in: "query", type: "string", required: false },
            { name: "page", in: "query", type: "integer", required: false, default: 1 },
            { name: "limit", in: "query", type: "integer", required: false, default: 10 },
          ],
          responses: {
            200: { description: "success", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },

      "/api/v2/products/v1": {
        get: {
          tags: ["Products v2"],
          summary: "Get products (v1 legacy endpoint)",
          parameters: [
            { name: "keyword", in: "query", type: "string", required: false },
            { name: "sku_code", in: "query", type: "string", required: false },
            { name: "category_code", in: "query", type: "string", required: false },
            { name: "page", in: "query", type: "integer", required: false, default: 1 },
            { name: "limit", in: "query", type: "integer", required: false, default: 10 },
          ],
          responses: {
            200: { description: "success", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },

      "/api/v2/products/all-not-limit": {
        get: {
          tags: ["Products v2"],
          summary: "Get all products (no limit)",
          responses: {
            200: { description: "success", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },

      "/api/v2/products/all-not-join": {
        get: {
          tags: ["Products v2"],
          summary: "Get all products (no join)",
          responses: {
            200: { description: "success", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },

      "/api/v2/products/all-with-loop": {
        get: {
          tags: ["Products v2"],
          summary: "Get all products (with loop join)",
          responses: {
            200: { description: "success", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },

      "/api/v2/products/export": {
        get: {
          tags: ["Products v2"],
          summary: "Export products (limit up to 30000)",
          parameters: [
            { name: "keyword", in: "query", type: "string", required: false },
            { name: "sku_code", in: "query", type: "string", required: false },
            { name: "category_code", in: "query", type: "string", required: false },
            {
              name: "limit",
              in: "query",
              type: "integer",
              required: false,
              default: 10000,
              description: "ในโค้ดจำกัดสูงสุด 30000",
            },
          ],
          responses: {
            200: { description: "success", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },

      "/api/v2/products/export-with-loop": {
        get: {
          tags: ["Products v2"],
          summary: "Export products (with loop join)",
          parameters: [
            { name: "keyword", in: "query", type: "string", required: false },
            { name: "sku_code", in: "query", type: "string", required: false },
            { name: "category_code", in: "query", type: "string", required: false },
            {
              name: "limit",
              in: "query",
              type: "integer",
              required: false,
              default: 10000,
              description: "ในโค้ดจำกัดสูงสุด 30000",
            },
          ],
          responses: {
            200: { description: "success", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },

      "/api/v2/products/create": {
        post: {
          tags: ["Products v2"],
          summary: "Create products (payload เป็น array) และสร้าง stock ตาม lot/warehouse",
          parameters: [
            {
              name: "body",
              in: "body",
              required: true,
              schema: { $ref: "#/definitions/CreateProductV2Payload" },
            },
          ],
          responses: {
            200: { description: "success", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },

      "/api/v2/products/import-excel": {
        post: {
          tags: ["Products v2"],
          summary: "Import products from Excel (file upload field: file)",
          consumes: ["multipart/form-data"],
          parameters: [
            {
              name: "file",
              in: "formData",
              required: true,
              type: "file",
              description: "Excel file (.xlsx)",
            },
          ],
          responses: {
            201: { description: "created", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },

      "/api/v2/products/detail": {
        get: {
          tags: ["Products v2"],
          summary: "Get product detail by barcode (includes stocks lookup)",
          parameters: [{ name: "barcode", in: "query", type: "string", required: true }],
          responses: {
            200: { description: "success", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },

      "/api/v2/products/update": {
        put: {
          tags: ["Products v2"],
          summary: "Update product and optionally stock fields (by barcode)",
          parameters: [
            {
              name: "body",
              in: "body",
              required: true,
              schema: { $ref: "#/definitions/UpdateProductV2Payload" },
            },
          ],
          responses: {
            200: { description: "success", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },

      "/api/v2/import-products/import": {
        post: {
          tags: ["Import Products v2"],
          summary: "Import products+stocks from Excel (service v2) field: file",
          consumes: ["multipart/form-data"],
          parameters: [
            {
              name: "file",
              in: "formData",
              required: true,
              type: "file",
              description: "Excel file (.xlsx)",
            },
          ],
          responses: {
            201: { description: "created", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },

      "/api/product-stocks/search/lot": {
        get: {
          tags: ["Product Stocks"],
          summary: "Search lots_no (unique) optional keyword",
          parameters: [{ name: "keyword", in: "query", type: "string", required: false }],
          responses: {
            200: { description: "success", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },

      "/api/product-stocks/search/warehouse": {
        get: {
          tags: ["Product Stocks"],
          summary: "Search warehouses_name + warehouses_zone (grouped) optional keyword",
          parameters: [{ name: "keyword", in: "query", type: "string", required: false }],
          responses: {
            200: { description: "success", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },

      "/api/product-stocks/import": {
        post: {
          tags: ["Product Stocks"],
          summary: "Import product stocks from CSV (file upload field: file)",
          consumes: ["multipart/form-data"],
          parameters: [
            {
              name: "file",
              in: "formData",
              required: true,
              type: "file",
              description: "CSV file",
            },
          ],
          responses: {
            200: { description: "success", schema: { $ref: "#/definitions/ApiSuccess" } },
            400: { description: "bad request", schema: { $ref: "#/definitions/ApiBadRequest" } },
          },
        },
      },
    },

    definitions: {
      ApiSuccess: {
        type: "object",
        properties: {
          status_code: { type: "integer", example: 200 },
          status_message: { type: "string", example: "success" },
          message: { type: "string" },
          result: { type: "object" },
        },
      },

      ApiBadRequest: {
        type: "object",
        properties: {
          status_code: { type: "integer", example: 400 },
          status_message: { type: "string", example: "bad request" },
          message: { type: "string" },
          result: { type: "object" },
        },
      },

      // โครงสร้างคร่าว ๆ เผื่อ
      ProductV2: {
        type: "object",
        required: ["barcode", "product_name"],
        properties: {
          barcode: { type: "string", example: "8851234567890" },
          sku_code: { type: "string", example: "SKU-001" },
          product_name: { type: "string", example: "iPhone 15 Pro Max 256GB" },
          product_description: { type: "string", example: "สี Natural Titanium" },
          category_code: { type: "integer", example: 1 },
          supplier_code: { type: "integer", example: 1001 },
          brand_code: { type: "integer", example: 2001 },
          unit: { type: "string", example: "ชิ้น" },
          cost_price: { type: "number", format: "double", example: 45000 },
          balance_qty: { type: "number", format: "double", example: 10 },
          status: { type: "string", example: "active" },
          created_by: { type: "string", example: "admin" },
          updated_by: { type: "string", example: "admin" },
          updated_at: { type: "string", format: "date-time" },
        },
      },

      ProductStock: {
        type: "object",
        required: ["barcode", "lots_no", "warehouses_name"],
        properties: {
          barcode: { type: "string", example: "8851234567890" },
          sku_code: { type: "string", example: "SKU-001" },
          lots_no: { type: "string", example: "LOT-2026-001" },
          warehouses_name: { type: "string", example: "WH-A" },
          warehouses_zone: { type: "string", example: "Z1" },
          bin: { type: "string", example: "BIN-01" },
          stock_type: { type: "string", example: "NORMAL" },
          receive_qty: { type: "number", format: "double", example: 10 },
          selling_qty: { type: "number", format: "double", example: 0 },
          balance_qty: { type: "number", format: "double", example: 10 },
          mfg: { type: "string", format: "date-time" },
          exp: { type: "string", format: "date-time" },
          status: { type: "string", example: "active" },
          created_by: { type: "string", example: "import" },
          updated_by: { type: "string", example: "import" },
        },
      },

      CreateProductV2Item: {
        type: "object",
        required: ["barcode", "product_name", "lot_no", "warehouse_name"],
        properties: {
          barcode: { type: "string" },
          sku_code: { type: "string" },
          product_name: { type: "string" },
          product_description: { type: "string" },
          category_code: { type: "integer" },
          supplier_code: { type: "integer" },
          brand_code: { type: "integer" },
          unit: { type: "string" },
          cost_price: { type: "number", format: "double" },

          lot_no: { type: "string", description: "จะถูก map ไปเป็น lots_no ใน product_stocks" },
          warehouse_name: {
            type: "string",
            description: "จะถูก map ไปเป็น warehouses_name ใน product_stocks",
          },
          warehouse_zone: { type: "string" },
          bin: { type: "string" },
          stock_type: { type: "string" },
          receive_qty: { type: "number", format: "double" },
          mfg: { type: "string", format: "date" },
          exp: { type: "string", format: "date" },

          status: { type: "string" },
          created_by: { type: "string" },
        },
      },

      CreateProductV2Payload: {
        type: "array",
        items: { $ref: "#/definitions/CreateProductV2Item" },
      },

      UpdateProductV2Payload: {
        type: "object",
        required: ["barcode"],
        properties: {
          barcode: { type: "string" },
          sku_code: { type: "string" },
          product_name: { type: "string" },
          product_description: { type: "string" },
          category_code: { type: "integer" },
          supplier_code: { type: "integer" },
          brand_code: { type: "integer" },
          unit: { type: "string" },
          cost_price: { type: "number", format: "double" },

          lot_no: { type: "string" },
          warehouse_name: { type: "string" },
          warehouse_zone: { type: "string" },
          bin: { type: "string" },
          stock_type: { type: "string" },
          receive_qty: { type: "number", format: "double" },
          mfg: { type: "string", format: "date" },
          exp: { type: "string", format: "date" },

          updated_by: { type: "string" },
          status: { type: "string" },
        },
      },
    },
  },

  apis: ["./routes/*.js", "./app.js"],
};

const specs = swaggerJsdoc(optionsV2);
module.exports = specs;
