const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Mongokakaidee API Documentation",
      version: "1.0.0",
      description:
        "ระบบจัดการข้อมูลสินค้า (Inventory Management API) สำหรับโปรเจกต์ mongokakaidee",
      contact: { name: "Developer Support" },
    },
    servers: [
      { url: "http://localhost:3000", description: "Development server" },
    ],

    tags: [
      { name: "Health" },
      { name: "Categories" },
      { name: "Products" },
      { name: "Stocks" },
      { name: "SKU Units" },
      { name: "Unit" },
      { name: "Search Product Service" },
      { name: "Insert Product Service" },
      { name: "Transaction Logs" },
      { name: "Maintenance" },
    ],

    components: {
      schemas: {
        Product: {
          type: "object",
          required: ["barcode", "title", "price"],
          properties: {
            _id: {
              type: "string",
              description: "ID อัตโนมัติจาก MongoDB",
              example: "65a1234b56789c01234d5678",
            },
            barcode: {
              type: "string",
              description: "รหัสบาร์โค้ดสินค้า",
              example: "8851234567890",
            },
            title: {
              type: "string",
              description: "ชื่อสินค้า",
              example: "iPhone 15 Pro Max 256GB",
            },
            description: {
              type: "string",
              description: "รายละเอียดสินค้าเพิ่มเติม",
              example: "สี Natural Titanium สภาพใหม่แกะกล่อง",
            },
            price: { type: "number", description: "ราคาสินค้า", example: 45000 },
            category_code: { type: "string", example: "CAT-ELEC-001" },
            brand_code: { type: "string", example: "APPLE" },
            supplier_code: { type: "string", example: "SUP-001" },
            image_url: { type: "string", example: "https://example.com/a.jpg" },
            status: {
              type: "string",
              enum: ["active", "inactive"],
              default: "active",
              description:
                "สถานะของสินค้า (active = พร้อมขาย, inactive = ลบ/ไม่ใช้งาน)",
            },
            updated_at: { type: "string", format: "date-time" },
          },
        },

        Category: {
          type: "object",
          properties: {
            _id: { type: "string", example: "65a1234b56789c01234d5678" },
            category_code: { type: "number", example: 101 },
            category_name_th: { type: "string", example: "เครื่องดื่ม" },
            category_name_en: { type: "string", example: "Beverage" },
            status: { type: "string", example: "active" },
            updated_at: { type: "string", format: "date-time" },
          },
        },

        Unit: {
          type: "object",
          properties: {
            _id: { type: "string", example: "65a1234b56789c01234d5678" },
            unit_code: { type: "number", example: 1 },
            name: { type: "string", example: "ชิ้น" },
            status: { type: "string", example: "active" },
          },
        },

        SkuUnit: {
          type: "object",
          properties: {
            _id: { type: "string", example: "65a1234b56789c01234d5678" },
            sku_code: { type: "string", example: "001020" },
            barcode: { type: "string", example: "8851234567890" },
            unit: { type: "string", example: "ชิ้น" },
            factor: { type: "number", example: 1 },
            price: { type: "number", example: 35 },
            status: { type: "string", example: "active" },
            updated_at: { type: "string", format: "date-time" },
          },
        },

        Stock: {
          type: "object",
          properties: {
            _id: { type: "string", example: "65a1234b56789c01234d5678" },
            barcode: { type: "string", example: "8851234567890" },
            receive_qty: { type: "number", example: 10 },
            selling_qty: { type: "number", example: 3 },
            balance_qty: { type: "number", example: 7 },
            updated_at: { type: "string", format: "date-time" },
          },
        },

        TransactionLogList: {
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            page: { type: "number", example: 1 },
            totalPages: { type: "number", example: 10 },
            total: { type: "number", example: 200 },
          },
        },

        Error: {
          type: "object",
          properties: { message: { type: "string", example: "error message" } },
        },
      },
    },

    paths: {
      // -------------------------
      // Health Check
      // -------------------------
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          responses: {
            200: { description: "OK", content: { "text/plain": {} } },
          },
        },
      },

      // -------------------------
      // Categories
      // -------------------------
      "/api/categories": {
        get: {
          tags: ["Categories"],
          summary: "Get categories (optional keyword search)",
          parameters: [
            {
              in: "query",
              name: "keyword",
              schema: { type: "string" },
              description: "ค้นหาด้วย category_name_th แบบ regex (case-insensitive)",
            },
          ],
          responses: {
            200: {
              description: "Success",
              content: {
                "application/json": {
                  schema: { type: "object" }, // response.success wrapper
                },
              },
            },
            400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          tags: ["Categories"],
          summary: "Create category",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Category" } },
            },
          },
          responses: {
            201: { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Category" } } } },
            400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      "/api/categories/import": {
        post: {
          tags: ["Categories"],
          summary: "Import categories from CSV (multipart/form-data)",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    file: { type: "string", format: "binary" },
                  },
                  required: ["file"],
                },
              },
            },
          },
          responses: {
            200: { description: "Imported (response.success wrapper)" },
            400: { description: "Bad request" },
          },
        },
      },

      // -------------------------
      // Products
      // -------------------------
      "/api/products": {
        get: {
          tags: ["Products"],
          summary: "List products (filter by q/category_code/brand_code/supplier_code)",
          parameters: [
            { in: "query", name: "q", schema: { type: "string" }, description: "Text search ($text $search)" },
            { in: "query", name: "category_code", schema: { type: "string" } },
            { in: "query", name: "brand_code", schema: { type: "string" } },
            { in: "query", name: "supplier_code", schema: { type: "string" } },
          ],
          responses: {
            200: {
              description: "Array of products (max 100)",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: "#/components/schemas/Product" } },
                },
              },
            },
          },
        },
        post: {
          tags: ["Products"],
          summary: "Create product",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } },
          },
          responses: {
            201: { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } },
            400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },

      "/api/products/{barcode}": {
        get: {
          tags: ["Products"],
          summary: "Get product by barcode",
          parameters: [{ in: "path", name: "barcode", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Product", content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } },
            404: { description: "Not found" },
          },
        },
        put: {
          tags: ["Products"],
          summary: "Update product by barcode",
          parameters: [{ in: "path", name: "barcode", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: {
            200: { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } },
            400: { description: "Bad request" },
            404: { description: "Not found" },
          },
        },
        delete: {
          tags: ["Products"],
          summary: "Soft delete product by barcode (set status=inactive)",
          parameters: [{ in: "path", name: "barcode", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Updated (inactive)" },
            404: { description: "Not found" },
          },
        },
      },

      // -------------------------
      // Delete product master by limit
      // -------------------------
      "/api/product_del/del": {
        delete: {
          tags: ["Maintenance"],
          summary: "Delete many products (oldest first) with limit",
          parameters: [
            {
              in: "query",
              name: "limit",
              schema: { type: "integer", default: 1000, maximum: 200000, minimum: 1 },
              description: "จำนวนที่จะลบ",
            },
          ],
          responses: {
            200: { description: "Delete result" },
            500: { description: "Server error" },
          },
        },
      },

      // -------------------------
      // Stocks
      // -------------------------
      "/api/stocks": {
        post: {
          tags: ["Stocks"],
          summary: "Create stock record (auto calc balance_qty = receive - selling when provided)",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/Stock" } } },
          },
          responses: {
            201: { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Stock" } } } },
            400: { description: "Bad request" },
          },
        },
      },

      "/api/stocks/by-barcode/{barcode}": {
        get: {
          tags: ["Stocks"],
          summary: "Get stock records by barcode",
          parameters: [{ in: "path", name: "barcode", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Array of stock records", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Stock" } } } } },
          },
        },
      },

      // -------------------------
      // SKU Units
      // -------------------------
      "/api/sku-units": {
        get: {
          tags: ["SKU Units"],
          summary: "List sku-units (filter by sku_code/status)",
          parameters: [
            { in: "query", name: "sku_code", schema: { type: "string" } },
            { in: "query", name: "status", schema: { type: "string", enum: ["active", "inactive"] } },
          ],
          responses: {
            200: { description: "Array", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/SkuUnit" } } } } },
          },
        },
        post: {
          tags: ["SKU Units"],
          summary: "Create sku-unit",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/SkuUnit" } } },
          },
          responses: {
            201: { description: "Created" },
            400: { description: "Bad request" },
          },
        },
      },

      "/api/sku-units/{id}": {
        get: {
          tags: ["SKU Units"],
          summary: "Get sku-unit by id",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "OK" }, 404: { description: "Not found" } },
        },
        put: {
          tags: ["SKU Units"],
          summary: "Update sku-unit by id",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { 200: { description: "OK" }, 400: { description: "Bad request" }, 404: { description: "Not found" } },
        },
        delete: {
          tags: ["SKU Units"],
          summary: "Soft delete sku-unit by id (set status=inactive)",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "OK" }, 404: { description: "Not found" } },
        },
      },

      // -------------------------
      // Unit
      // -------------------------
      "/api/unit": {
        get: {
          tags: ["Unit"],
          summary: "Get units (optional keyword search)",
          parameters: [
            { in: "query", name: "keyword", schema: { type: "string" }, description: "ค้นหาด้วย name แบบ regex" },
          ],
          responses: { 200: { description: "Success (response.success wrapper)" }, 400: { description: "Bad request" } },
        },
      },

      "/api/unit/import": {
        post: {
          tags: ["Unit"],
          summary: "Import units from CSV (multipart/form-data)",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: { file: { type: "string", format: "binary" } },
                  required: ["file"],
                },
              },
            },
          },
          responses: { 200: { description: "Imported (response.success wrapper)" }, 400: { description: "Bad request" } },
        },
      },

      // -------------------------
      // Search Product Service
      // -------------------------
      "/api/search_product_service": {
        get: {
          tags: ["Search Product Service"],
          summary: "Service info",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Search Product Service"],
          summary: "Insert 1 product + 1 sku_unit (จาก body.product + body.skus[0])",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    product: {
                      type: "object",
                      properties: {
                        sku: { type: "string", example: "001020" },
                        product_name: { type: "string", example: "โค้ก" },
                      },
                      required: ["sku", "product_name"],
                    },
                    skus: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          barcode: { type: "string", example: "8851234567890" },
                          unit: { type: "string", example: "ขวด" },
                          factor: { type: "number", example: 1 },
                          price: { type: "number", example: 20 },
                        },
                        required: ["unit"],
                      },
                      minItems: 1,
                    },
                  },
                  required: ["product", "skus"],
                },
              },
            },
          },
          responses: { 201: { description: "Created" }, 400: { description: "Bad request" } },
        },
      },

      "/api/search_product_service/search": {
        get: {
          tags: ["Search Product Service"],
          summary: "Search products with sku-unit join + paging",
          parameters: [
            { in: "query", name: "keyword", schema: { type: "string" } },
            { in: "query", name: "unit", schema: { type: "string" } },
            { in: "query", name: "page", schema: { type: "integer", default: 1, minimum: 1 } },
            { in: "query", name: "limit", schema: { type: "integer", default: 10, minimum: 1, maximum: 100 } },
          ],
          responses: { 200: { description: "OK" }, 500: { description: "Server error" } },
        },
      },

      "/api/search_product_service/bucket": {
        get: {
          tags: ["Search Product Service"],
          summary: "Bucket aggregate (type = unit | sku | price)",
          parameters: [
            { in: "query", name: "type", required: true, schema: { type: "string", enum: ["unit", "sku", "price"] } },
          ],
          responses: { 200: { description: "OK" }, 500: { description: "Server error" } },
        },
      },

      "/api/search_product_service/count": {
        get: {
          tags: ["Search Product Service"],
          summary: "Count products (estimated by default)",
          parameters: [
            { in: "query", name: "keyword", schema: { type: "string" } },
            { in: "query", name: "estimated", schema: { type: "string", default: "1", description: "1=estimatedDocumentCount (เร็ว), 0=countDocuments" } },
          ],
          responses: { 200: { description: "OK" }, 500: { description: "Server error" } },
        },
      },

      "/api/search_product_service/scan": {
        get: {
          tags: ["Search Product Service"],
          summary: "Cursor scan count (เร็ว/ประหยัด memory)",
          parameters: [
            { in: "query", name: "keyword", schema: { type: "string" } },
            { in: "query", name: "max", schema: { type: "integer", default: 100000 } },
            { in: "query", name: "batch", schema: { type: "integer", default: 1000 } },
          ],
          responses: { 200: { description: "OK" }, 500: { description: "Server error" } },
        },
      },

      "/api/search_product_service/scan_full": {
        get: {
          tags: ["Search Product Service"],
          summary: "Aggregate + lookup scan (product + sku_units)",
          parameters: [
            { in: "query", name: "keyword", schema: { type: "string" } },
            { in: "query", name: "max", schema: { type: "integer", default: 100000 } },
            { in: "query", name: "batch", schema: { type: "integer", default: 500 } },
          ],
          responses: { 200: { description: "OK" }, 500: { description: "Server error" } },
        },
      },

      // -------------------------
      // Insert Product Service (Excel)
      // -------------------------
      "/api/insert_product_service/excel": {
        post: {
          tags: ["Insert Product Service"],
          summary: "Upload .xlsx and process in background (respond immediately with job_id)",
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: { file: { type: "string", format: "binary" } },
                  required: ["file"],
                },
              },
            },
          },
          responses: {
            200: { description: "Accepted (job queued)" },
            400: { description: "No file" },
          },
        },
      },

      // -------------------------
      // Transaction Logs (มี 2 base)
      // -------------------------
      "/api/transaction_logs": {
        get: {
          tags: ["Transaction Logs"],
          summary: "List logs (filter by function_name/request_id/status_code)",
          parameters: [
            { in: "query", name: "page", schema: { type: "integer", default: 1 } },
            { in: "query", name: "limit", schema: { type: "integer", default: 20, maximum: 200 } },
            { in: "query", name: "function_name", schema: { type: "string" } },
            { in: "query", name: "request_id", schema: { type: "string" } },
            { in: "query", name: "status_code", schema: { type: "string" } },
          ],
          responses: {
            200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/TransactionLogList" } } } },
            500: { description: "Server error" },
          },
        },
      },

      "/api/transaction_logs/get-log": {
        get: {
          tags: ["Transaction Logs"],
          summary: "Get logs (response.success wrapper) with paging",
          parameters: [
            { in: "query", name: "page", schema: { type: "integer", default: 1 } },
            { in: "query", name: "limit", schema: { type: "integer", default: 10, maximum: 100 } },
          ],
          responses: { 200: { description: "OK" }, 400: { description: "Bad request" } },
        },
      },

      "/api/transaction_logs/export": {
        get: {
          tags: ["Transaction Logs"],
          summary: "Export logs as base64 xlsx (optional limit)",
          parameters: [
            { in: "query", name: "limit", schema: { type: "integer", default: 0 }, description: "0 = export ทั้งหมด" },
          ],
          responses: { 200: { description: "OK (base64_file + export_name)" }, 400: { description: "Bad request" } },
        },
      },

      "/api/transaction-logs": {
        get: {
          tags: ["Transaction Logs"],
          summary: "Alias of /api/transaction_logs",
          responses: { 200: { description: "OK" } },
        },
      },
      "/api/transaction-logs/get-log": {
        get: { tags: ["Transaction Logs"], summary: "Alias of /api/transaction_logs/get-log", responses: { 200: { description: "OK" } } },
      },
      "/api/transaction-logs/export": {
        get: { tags: ["Transaction Logs"], summary: "Alias of /api/transaction_logs/export", responses: { 200: { description: "OK" } } },
      },
    },
  },

 apis: ['./routes/*.js', './app.js'], }; 
 const specs = swaggerJsdoc(options); module.exports = specs;