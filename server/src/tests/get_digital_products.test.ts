import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { digitalProductsTable } from '../db/schema';
import { getDigitalProducts } from '../handlers/get_digital_products';

describe('getDigitalProducts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no products exist', async () => {
    const result = await getDigitalProducts();
    
    expect(result).toEqual([]);
  });

  it('should return only active products', async () => {
    // Create test products - one active, one inactive
    await db.insert(digitalProductsTable).values([
      {
        name: 'Active Product',
        description: 'This product is active',
        price: '29.99',
        download_url: 'https://example.com/active',
        is_active: true
      },
      {
        name: 'Inactive Product',
        description: 'This product is inactive',
        price: '19.99',
        download_url: 'https://example.com/inactive',
        is_active: false
      }
    ]).execute();

    const result = await getDigitalProducts();

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Active Product');
    expect(result[0].is_active).toBe(true);
  });

  it('should convert price from string to number', async () => {
    // Create test product
    await db.insert(digitalProductsTable).values({
      name: 'Test Product',
      description: 'Test product with price',
      price: '99.99',
      download_url: 'https://example.com/test',
      is_active: true
    }).execute();

    const result = await getDigitalProducts();

    expect(result).toHaveLength(1);
    expect(typeof result[0].price).toBe('number');
    expect(result[0].price).toEqual(99.99);
  });

  it('should return all product fields correctly', async () => {
    // Create test product with all fields
    await db.insert(digitalProductsTable).values({
      name: 'Complete Product',
      description: 'Product with all fields',
      price: '149.50',
      download_url: 'https://example.com/complete',
      is_active: true
    }).execute();

    const result = await getDigitalProducts();

    expect(result).toHaveLength(1);
    const product = result[0];
    
    // Verify all fields are present and correct
    expect(product.id).toBeDefined();
    expect(product.name).toEqual('Complete Product');
    expect(product.description).toEqual('Product with all fields');
    expect(product.price).toEqual(149.50);
    expect(product.download_url).toEqual('https://example.com/complete');
    expect(product.is_active).toBe(true);
    expect(product.created_at).toBeInstanceOf(Date);
  });

  it('should handle nullable fields correctly', async () => {
    // Create product with nullable fields set to null
    await db.insert(digitalProductsTable).values({
      name: 'Minimal Product',
      description: null, // Nullable field
      price: '25.00',
      download_url: null, // Nullable field
      is_active: true
    }).execute();

    const result = await getDigitalProducts();

    expect(result).toHaveLength(1);
    const product = result[0];
    
    expect(product.name).toEqual('Minimal Product');
    expect(product.description).toBeNull();
    expect(product.price).toEqual(25.00);
    expect(product.download_url).toBeNull();
    expect(product.is_active).toBe(true);
  });

  it('should return multiple products in correct order', async () => {
    // Create multiple active products
    await db.insert(digitalProductsTable).values([
      {
        name: 'Product A',
        description: 'First product',
        price: '10.00',
        download_url: 'https://example.com/a',
        is_active: true
      },
      {
        name: 'Product B',
        description: 'Second product',
        price: '20.00',
        download_url: 'https://example.com/b',
        is_active: true
      },
      {
        name: 'Product C',
        description: 'Third product',
        price: '30.00',
        download_url: 'https://example.com/c',
        is_active: true
      }
    ]).execute();

    const result = await getDigitalProducts();

    expect(result).toHaveLength(3);
    
    // Verify each product has correct data types and values
    result.forEach((product, index) => {
      expect(product.id).toBeDefined();
      expect(typeof product.name).toBe('string');
      expect(typeof product.price).toBe('number');
      expect(product.is_active).toBe(true);
      expect(product.created_at).toBeInstanceOf(Date);
    });

    // Verify specific products
    const productNames = result.map(p => p.name);
    expect(productNames).toContain('Product A');
    expect(productNames).toContain('Product B');
    expect(productNames).toContain('Product C');
  });

  it('should exclude inactive products from mixed dataset', async () => {
    // Create mixed active and inactive products
    await db.insert(digitalProductsTable).values([
      {
        name: 'Active Product 1',
        description: 'Active',
        price: '15.00',
        download_url: 'https://example.com/active1',
        is_active: true
      },
      {
        name: 'Inactive Product 1',
        description: 'Inactive',
        price: '25.00',
        download_url: 'https://example.com/inactive1',
        is_active: false
      },
      {
        name: 'Active Product 2',
        description: 'Active',
        price: '35.00',
        download_url: 'https://example.com/active2',
        is_active: true
      },
      {
        name: 'Inactive Product 2',
        description: 'Inactive',
        price: '45.00',
        download_url: 'https://example.com/inactive2',
        is_active: false
      }
    ]).execute();

    const result = await getDigitalProducts();

    expect(result).toHaveLength(2);
    
    // Verify only active products are returned
    const productNames = result.map(p => p.name);
    expect(productNames).toContain('Active Product 1');
    expect(productNames).toContain('Active Product 2');
    expect(productNames).not.toContain('Inactive Product 1');
    expect(productNames).not.toContain('Inactive Product 2');
    
    // Verify all returned products are active
    result.forEach(product => {
      expect(product.is_active).toBe(true);
    });
  });
});