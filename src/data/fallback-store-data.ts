export interface FallbackProduct {
  id: string;
  name: string;
  salePrice: number;
  purchasePrice: number;
  description?: string;
  photoUrls: string[];
  branchId: string;
  active: boolean;
  sequence: number;
}

export interface FallbackBranch {
  id: string;
  name: string;
  categoryId: string;
  photoUrl: string;
  sequence: number;
  products: FallbackProduct[];
}

export interface FallbackCategory {
  id: string;
  name: string;
  photoUrl: string;
  sequence: number;
  branches: FallbackBranch[];
}

export const FALLBACK_STORE_DATA: FallbackCategory[] = [
  {
    id: "cat_lahm_bajeen",
    name: "قسم لحم بعجين",
    photoUrl: "/products/lahm_large_normal.jpg",
    sequence: 10,
    branches: [
      {
        id: "br_lahm_small",
        name: "لحم بعجين صغير",
        categoryId: "cat_lahm_bajeen",
        photoUrl: "/products/lahm_small_normal.jpg",
        sequence: 10,
        products: [
          {
            id: "prod_lahm_s_norm",
            name: "لحم بعجين صغير عادي",
            salePrice: 2000,
            purchasePrice: 2000,
            photoUrls: ["/products/lahm_small_normal.jpg"],
            branchId: "br_lahm_small",
            active: true,
            sequence: 10
          },
          {
            id: "prod_lahm_s_cheese",
            name: "لحم بعجين صغير بالجبنه",
            salePrice: 2500,
            purchasePrice: 2500,
            photoUrls: ["/products/lahm_small_cheese.jpg"],
            branchId: "br_lahm_small",
            active: true,
            sequence: 9
          },
          {
            id: "prod_lahm_s_egg",
            name: "لحم بعجين صغير بالبيض",
            salePrice: 2500,
            purchasePrice: 2500,
            photoUrls: ["/products/lahm_small_egg.jpg"],
            branchId: "br_lahm_small",
            active: true,
            sequence: 8
          },
          {
            id: "prod_lahm_s_zaatar",
            name: "لحم بعجين صغير بالزعتر",
            salePrice: 2500,
            purchasePrice: 2500,
            photoUrls: ["/products/lahm_small_zaatar.jpg"],
            branchId: "br_lahm_small",
            active: true,
            sequence: 7
          }
        ]
      },
      {
        id: "br_lahm_large",
        name: "لحم بعجين كبير",
        categoryId: "cat_lahm_bajeen",
        photoUrl: "/products/lahm_large_normal.jpg",
        sequence: 9,
        products: [
          {
            id: "prod_lahm_l_norm",
            name: "لحم بعجين كبير عادي",
            salePrice: 4000,
            purchasePrice: 4000,
            photoUrls: ["/products/lahm_large_normal.jpg"],
            branchId: "br_lahm_large",
            active: true,
            sequence: 10
          },
          {
            id: "prod_lahm_l_cheese",
            name: "لحم بعجين كبير بالجبنه",
            salePrice: 4500,
            purchasePrice: 4500,
            photoUrls: ["/products/lahm_small_cheese.jpg"],
            branchId: "br_lahm_large",
            active: true,
            sequence: 9
          },
          {
            id: "prod_lahm_l_egg",
            name: "لحم بعجين كبير بالبيض",
            salePrice: 4500,
            purchasePrice: 4500,
            photoUrls: ["/products/lahm_small_egg.jpg"],
            branchId: "br_lahm_large",
            active: true,
            sequence: 8
          },
          {
            id: "prod_lahm_l_zaatar",
            name: "لحم بعجين كبير بالزعتر",
            salePrice: 4500,
            purchasePrice: 4500,
            photoUrls: ["/products/lahm_small_zaatar.jpg"],
            branchId: "br_lahm_large",
            active: true,
            sequence: 7
          }
        ]
      }
    ]
  },
  {
    id: "cat_crispy",
    name: "قسم الكرسبي والمقبلات",
    photoUrl: "/products/crispy_5pcs.jpg",
    sequence: 9,
    branches: [
      {
        id: "br_crispy_finger",
        name: "الكرسبي والفنكر",
        categoryId: "cat_crispy",
        photoUrl: "/products/crispy_3pcs.jpg",
        sequence: 10,
        products: [
          {
            id: "prod_finger",
            name: "فنكر",
            salePrice: 1000,
            purchasePrice: 1000,
            photoUrls: ["/products/french_fries.jpg"],
            branchId: "br_crispy_finger",
            active: true,
            sequence: 10
          },
          {
            id: "prod_crispy_3",
            name: "كرسبي ثلاث قطع",
            salePrice: 3000,
            purchasePrice: 3000,
            photoUrls: ["/products/crispy_3pcs.jpg"],
            branchId: "br_crispy_finger",
            active: true,
            sequence: 9
          },
          {
            id: "prod_crispy_5",
            name: "كرسبي خمس قطع",
            salePrice: 5000,
            purchasePrice: 5000,
            photoUrls: ["/products/crispy_5pcs.jpg"],
            branchId: "br_crispy_finger",
            active: true,
            sequence: 8
          }
        ]
      }
    ]
  },
  {
    id: "cat_pizza",
    name: "قسم البيتزا",
    photoUrl: "/products/pizza_mixed.jpg",
    sequence: 8,
    branches: [
      {
        id: "br_pizza_large",
        name: "بيتزا كبير",
        categoryId: "cat_pizza",
        photoUrl: "/products/pizza_beef.jpg",
        sequence: 10,
        products: [
          {
            id: "prod_pizza_beef_l",
            name: "بيتزا لحم كبير",
            salePrice: 7000,
            purchasePrice: 7000,
            photoUrls: ["/products/pizza_beef.jpg"],
            branchId: "br_pizza_large",
            active: true,
            sequence: 10
          },
          {
            id: "prod_pizza_chic_l",
            name: "بيتزا دجاج كبير",
            salePrice: 7000,
            purchasePrice: 7000,
            photoUrls: ["/products/pizza_chicken.jpg"],
            branchId: "br_pizza_large",
            active: true,
            sequence: 9
          },
          {
            id: "prod_pizza_veg_l",
            name: "بيتزا خضار كبير",
            salePrice: 7000,
            purchasePrice: 7000,
            photoUrls: ["/products/pizza_veggie.jpg"],
            branchId: "br_pizza_large",
            active: true,
            sequence: 8
          },
          {
            id: "prod_pizza_mix_l",
            name: "بيتزا مشكل كبير",
            salePrice: 7000,
            purchasePrice: 7000,
            photoUrls: ["/products/pizza_mixed.jpg"],
            branchId: "br_pizza_large",
            active: true,
            sequence: 7
          }
        ]
      },
      {
        id: "br_pizza_small",
        name: "بيتزا صغير",
        categoryId: "cat_pizza",
        photoUrl: "/products/pizza_chicken.jpg",
        sequence: 9,
        products: [
          {
            id: "prod_pizza_beef_s",
            name: "بيتزا لحم صغير",
            salePrice: 4000,
            purchasePrice: 4000,
            photoUrls: ["/products/pizza_beef.jpg"],
            branchId: "br_pizza_small",
            active: true,
            sequence: 10
          },
          {
            id: "prod_pizza_chic_s",
            name: "بيتزا دجاج صغير",
            salePrice: 4000,
            purchasePrice: 4000,
            photoUrls: ["/products/pizza_chicken.jpg"],
            branchId: "br_pizza_small",
            active: true,
            sequence: 9
          },
          {
            id: "prod_pizza_veg_s",
            name: "بيتزا خضار صغير",
            salePrice: 4000,
            purchasePrice: 4000,
            photoUrls: ["/products/pizza_veggie.jpg"],
            branchId: "br_pizza_small",
            active: true,
            sequence: 8
          },
          {
            id: "prod_pizza_mix_s",
            name: "بيتزا مشكل صغير",
            salePrice: 4000,
            purchasePrice: 4000,
            photoUrls: ["/products/pizza_mixed.jpg"],
            branchId: "br_pizza_small",
            active: true,
            sequence: 7
          }
        ]
      }
    ]
  },
  {
    id: "cat_rizo",
    name: "قسم الريزو",
    photoUrl: "/products/rizo_spicy.jpg",
    sequence: 7,
    branches: [
      {
        id: "br_rizo",
        name: "الوجبات",
        categoryId: "cat_rizo",
        photoUrl: "/products/rizo_normal.jpg",
        sequence: 10,
        products: [
          {
            id: "prod_rizo_spicy_l",
            name: "ريزو سبايسي كبير",
            salePrice: 6000,
            purchasePrice: 6000,
            photoUrls: ["/products/rizo_spicy.jpg"],
            branchId: "br_rizo",
            active: true,
            sequence: 10
          },
          {
            id: "prod_rizo_spicy_s",
            name: "ريزو سبايسي صغير",
            salePrice: 4000,
            purchasePrice: 4000,
            photoUrls: ["/products/rizo_spicy.jpg"],
            branchId: "br_rizo",
            active: true,
            sequence: 9
          },
          {
            id: "prod_rizo_norm_l",
            name: "ريزو عادي كبير",
            salePrice: 5000,
            purchasePrice: 5000,
            photoUrls: ["/products/rizo_normal.jpg"],
            branchId: "br_rizo",
            active: true,
            sequence: 8
          },
          {
            id: "prod_rizo_norm_s",
            name: "ريزو عادي صغير",
            salePrice: 3000,
            purchasePrice: 3000,
            photoUrls: ["/products/rizo_normal.jpg"],
            branchId: "br_rizo",
            active: true,
            sequence: 7
          }
        ]
      }
    ]
  },
  {
    id: "cat_drinks",
    name: "قسم المشروبات الغازية",
    photoUrl: "/products/pepsi_can.jpg",
    sequence: 6,
    branches: [
      {
        id: "br_drinks",
        name: "المشروبات الغازية (قوطية)",
        categoryId: "cat_drinks",
        photoUrl: "/products/shani_can.jpg",
        sequence: 10,
        products: [
          {
            id: "prod_pepsi",
            name: "بيبسي (قوطية)",
            salePrice: 500,
            purchasePrice: 500,
            photoUrls: ["/products/pepsi_can.jpg"],
            branchId: "br_drinks",
            active: true,
            sequence: 10
          },
          {
            id: "prod_shani",
            name: "شاني (قوطية)",
            salePrice: 500,
            purchasePrice: 500,
            photoUrls: ["/products/shani_can.jpg"],
            branchId: "br_drinks",
            active: true,
            sequence: 9
          },
          {
            id: "prod_seven",
            name: "سفن (قوطية)",
            salePrice: 500,
            purchasePrice: 500,
            photoUrls: ["/products/seven_up_can.jpg"],
            branchId: "br_drinks",
            active: true,
            sequence: 8
          }
        ]
      }
    ]
  }
];
