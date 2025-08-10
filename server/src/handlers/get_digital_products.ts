import { db } from '../db';
import { digitalProductsTable } from '../db/schema';
import { type DigitalProduct } from '../schema';
import { eq } from 'drizzle-orm';

export const getDigitalProducts = async (): Promise<DigitalProduct[]> => {
  try {
    // Fetch all active digital products from the database
    const results = await db.select()
      .from(digitalProductsTable)
      .where(eq(digitalProductsTable.is_active, true))
      .execute();

    // Convert numeric price field back to numbers before returning
    return results.map(product => ({
      ...product,
      price: parseFloat(product.price) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to fetch digital products:', error);
    throw error;
  }
};