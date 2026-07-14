// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpenseEditor } from "../../src/renderer/components/ExpenseEditor";

afterEach(cleanup);
describe("fast expense entry",()=>{
  it("shows contextual credit fields and every approved category",async()=>{
    render(<ExpenseEditor units={[{id:"u1",name:"Unit 1",status:"active"}]} accounts={[]} suppliers={[{id:"s1",name:"Repairs",phone:null,email:null,balance:0 as never}]} onSave={vi.fn()} onCancel={vi.fn()}/>);
    expect(screen.getByRole("option",{name:"Electricity"})).toBeTruthy();
    expect(screen.getByRole("option",{name:"Netflix"})).toBeTruthy();
    expect(screen.getByRole("option",{name:"Complimentary coffee"})).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText("Purchase type"),"credit");
    expect(screen.getByLabelText("Supplier")).toBeTruthy();
    expect(screen.getByLabelText("Due date")).toBeTruthy();
  });
});
