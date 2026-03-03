package com.hedgelab.v2.repository.budget;

import com.hedgelab.v2.entity.budget.BudgetLineItemComponent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BudgetComponentRepository extends JpaRepository<BudgetLineItemComponent, UUID> {

    List<BudgetLineItemComponent> findByLineItemIdOrderByDisplayOrder(UUID lineItemId);

    void deleteByLineItemId(UUID lineItemId);
}
