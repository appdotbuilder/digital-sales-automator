import { db } from '../db';
import { digitalProductsTable } from '../db/schema';
import { type CreateProductInput, type DigitalProduct } from '../schema';

export const createProduct = async (input: CreateProductInput): Promise<DigitalProduct> => {
  try {
    // Insert digital product record
    const result = await db.insert(digitalProductsTable)
      .values({
        name: input.name,
        description: input.description || null,
        price: input.price.toString(), // Convert number to string for numeric column
        download_url: input.download_url || null,
        is_active: true // Default value
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const product = result[0];
    return {
      ...product,
      price: parseFloat(product.price) // Convert string back to number
    };
  } catch (error) {
    console.error('Digital product creation failed:', error);
    throw error;
  }
};