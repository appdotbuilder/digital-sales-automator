import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { digitalProductsTable } from '../db/schema';
import { type CreateProductInput } from '../schema';
import { createProduct } from '../handlers/create_product';
import { eq, gte } from 'drizzle-orm';

// Complete test input with all fields
const testInput: CreateProductInput = {
  name: 'Test Digital Product',
  description: 'A comprehensive digital product for testing',
  price: 99.99,
  download_url: 'https://example.com/download/test-product.zip'
};

// Test input with minimal required fields only
const minimalInput: CreateProductInput = {
  name: 'Minimal Product',
  price: 19.99
};

describe('createProduct', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a product with all fields', async () => {
    const result = await createProduct(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Digital Product');
    expect(result.description).toEqual('A comprehensive digital product for testing');
    expect(result.price).toEqual(99.99);
    expect(typeof result.price).toBe('number');
    expect(result.download_url).toEqual('https://example.com/download/test-product.zip');
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a product with minimal fields', async () => {
    const result = await createProduct(minimalInput);

    // Basic field validation
    expect(result.name).toEqual('Minimal Product');
    expect(result.description).toBeNull();
    expect(result.price).toEqual(19.99);
    expect(typeof result.price).toBe('number');
    expect(result.download_url).toBeNull();
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save product to database correctly', async () => {
    const result = await createProduct(testInput);

    // Query using proper drizzle syntax
    const products = await db.select()
      .from(digitalProductsTable)
      .where(eq(digitalProductsTable.id, result.id))
      .execute();

    expect(products).toHaveLength(1);
    expect(products[0].name).toEqual('Test Digital Product');
    expect(products[0].description).toEqual('A comprehensive digital product for testing');
    expect(parseFloat(products[0].price)).toEqual(99.99);
    expect(products[0].download_url).toEqual('https://example.com/download/test-product.zip');
    expect(products[0].is_active).toBe(true);
    expect(products[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle null optional fields in database', async () => {
    const result = await createProduct(minimalInput);

    // Query database record
    const products = await db.select()
      .from(digitalProductsTable)
      .where(eq(digitalProductsTable.id, result.id))
      .execute();

    expect(products).toHaveLength(1);
    expect(products[0].name).toEqual('Minimal Product');
    expect(products[0].description).toBeNull();
    expect(parseFloat(products[0].price)).toEqual(19.99);
    expect(products[0].download_url).toBeNull();
    expect(products[0].is_active).toBe(true);
  });

  it('should properly handle numeric price conversion', async () => {
    const priceTest: CreateProductInput = {
      name: 'Price Test Product',
      price: 123.45
    };

    const result = await createProduct(priceTest);

    // Verify price is returned as number
    expect(result.price).toEqual(123.45);
    expect(typeof result.price).toBe('number');

    // Verify price is stored correctly in database
    const products = await db.select()
      .from(digitalProductsTable)
      .where(eq(digitalProductsTable.id, result.id))
      .execute();

    expect(parseFloat(products[0].price)).toEqual(123.45);
  });

  it('should create multiple products with unique IDs', async () => {
    const product1 = await createProduct({
      name: 'Product One',
      price: 29.99
    });

    const product2 = await createProduct({
      name: 'Product Two',
      price: 39.99
    });

    // Each product should have unique ID
    expect(product1.id).not.toEqual(product2.id);
    expect(product1.name).toEqual('Product One');
    expect(product2.name).toEqual('Product Two');

    // Verify both exist in database
    const allProducts = await db.select()
      .from(digitalProductsTable)
      .where(gte(digitalProductsTable.id, Math.min(product1.id, product2.id)))
      .execute();

    expect(allProducts.length).toBeGreaterThanOrEqual(2);
  });

  it('should set created_at timestamp correctly', async () => {
    const beforeCreation = new Date();
    const result = await createProduct(testInput);
    const afterCreation = new Date();

    // Verify created_at is within reasonable time range
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime() - 1000); // Allow 1 second buffer
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime() + 1000);
  });

  it('should default is_active to true', async () => {
    const result = await createProduct(minimalInput);

    expect(result.is_active).toBe(true);

    // Verify in database
    const products = await db.select()
      .from(digitalProductsTable)
      .where(eq(digitalProductsTable.id, result.id))
      .execute();

    expect(products[0].is_active).toBe(true);
  });
});